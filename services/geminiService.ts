/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type, Part } from "@google/genai";
import { Hotspot, DetectedObject } from '../types.ts';
import { createExpandedCanvas } from '../utils.ts';
import { dataURLtoFile } from '../utils.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<Part> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    if (!response) {
        console.error(`Received null or undefined response from API during ${context}.`);
        throw new Error(`ИИ вернул неверный ответ. Пожалуйста, попробуйте еще раз.`);
    }
    // 1. Check for prompt blocking first (input validation)
    if (response.promptFeedback?.blockReason) {
        const { blockReason, safetyRatings } = response.promptFeedback;
        let userMessage: string;

        if (blockReason === 'SAFETY' || blockReason === 'PROHIBITED_CONTENT') {
             const specificReasons = safetyRatings?.filter(r => r.blocked).map(r => r.category.replace('HARM_CATEGORY_', '').toLowerCase()).join(', ');
             userMessage = `Ваш запрос не был обработан из-за фильтров безопасности${specificReasons ? `, связанных с: ${specificReasons}` : ''}. Пожалуйста, перефразируйте свой запрос, избегая потенциально чувствительных тем.`;
        } else { // Catches 'OTHER' and future block reasons
            userMessage = `Ваш запрос был заблокирован по неуказанной причине. Попробуйте изменить запрос или использовать другое изображение.`;
        }
        
        console.error(`Prompt blocked during ${context}. Reason: ${blockReason}`, { response });
        throw new Error(userMessage);
    }

    // 2. Try to find the image part in the response
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part?.inlineData?.data);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, analyze the reason why generation stopped
    const finishReason = response.candidates?.[0]?.finishReason;
    const finishMessage = response.candidates?.[0]?.finishMessage;
    
    if (finishReason && finishReason !== 'STOP') {
        let userMessage: string;
        
        switch (finishReason) {
            case 'SAFETY':
                userMessage = `Генерация изображения была остановлена из-за соображений безопасности. Пожалуйста, попробуйте другой запрос или изображение.`;
                break;
            case 'RECITATION':
                userMessage = `Генерация изображения была остановлена, чтобы избежать цитирования материалов, защищенных авторским правом. Пожалуйста, попробуйте более оригинальный запрос.`;
                break;
            case 'MAX_TOKENS':
                userMessage = `Запрос для '${context}' был слишком сложным для обработки ИИ. Попробуйте упростить ваш запрос или использовать меньшую область изображения.`;
                break;
            default: // Catches 'OTHER' and any future reasons
                const multiImageContexts = ['face swap', 'clothing change', 'background replacement from image', 'add person', 'add object', 'mix & match', 'style transfer', 'edit', 'facial enhancement', 'color adjustment'];
                if (multiImageContexts.some(c => context === c)) {
                   userMessage = `ИИ не смог обработать одно из предоставленных изображений. Это может произойти с неподдерживаемыми форматами или если изображение повреждено. Пожалуйста, попробуйте использовать другие, четкие изображения.`;
                } else {
                   userMessage = `ИИ не смог обработать предоставленное изображение. Это может произойти с неподдерживаемыми форматами или если изображение повреждено. Пожалуйста, попробуйте другое изображение.`;
                }
                break;
        }

        console.error(`Image generation failed during ${context}. Reason: ${finishReason}`, { finishMessage, response });
        throw new Error(userMessage);
    }
    
    // 4. Fallback error if no image and no other specific failure reason is found
    const textFeedback = response.text?.trim();
    const errorMessage = textFeedback
        ? `ИИ ответил текстом вместо изображения для '${context}': "${textFeedback}". Пожалуйста, попробуйте перефразировать ваш запрос, чтобы он был более конкретным относительно визуального изменения, которое вы хотите.`
        : `Модель ИИ не вернула изображение для '${context}'. Это может произойти, если запрос слишком сложный или неоднозначный. Пожалуйста, попробуйте перефразировать ваш запрос.`;

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

const GENERIC_API_ERROR_MESSAGE = 'Не удалось связаться с сервисом ИИ. Пожалуйста, проверьте ваше интернет-соединение и попробуйте еще раз.';

const isCustomError = (message: string) => {
    return message && (message.startsWith('Ваш запрос') || message.startsWith('Генерация изображения была остановлена') || message.startsWith("Запрос для '") || message.startsWith('ИИ не смог обработать') || message.startsWith('ИИ ответил текстом') || message.startsWith('ИИ вернул неверный ответ') || message.startsWith('Модель ИИ не вернула изображение') || message.startsWith('Эта функция ИИ, к сожалению, недоступна') || message.startsWith('Предоставленный ключ API недействителен'));
}

const handleApiError = (err: any, context: string): Error => {
    console.error(`Error during ${context}:`, err);
    if (err instanceof Error && isCustomError(err.message)) return err;
    let specificMessage = err.message || '';
    if (specificMessage.includes('API key not valid')) return new Error('Предоставленный ключ API недействителен. Пожалуйста, проверьте вашу конфигурацию.');
    return new Error(GENERIC_API_ERROR_MESSAGE);
};

async function executeApiCall<T>(context: string, apiCall: () => Promise<T>): Promise<T> {
    try {
        return await apiCall();
    } catch (err: any) {
        throw handleApiError(err, context);
    }
}

/**
 * Generic helper to perform an image modification task.
 * @param context A string describing the operation for clear error messages.
 * @param imageFile The primary image file to modify.
 * @param parts An array of additional parts (text prompts, masks, reference images).
 * @returns A promise resolving to the data URL of the modified image.
 */
const generateImageModification = async (
    context: string,
    imageFile: File,
    parts: Part[]
): Promise<string> => {
    return executeApiCall(context, async () => {
        const imagePart = await fileToPart(imageFile);
        const allParts = [...parts, imagePart];
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: allParts },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        return handleApiResponse(response, context);
    });
};

export const generateImageFromPrompt = (prompt: string): Promise<string> => {
    return executeApiCall('image generation from prompt', async () => {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        });

        if (response.generatedImages?.length > 0) {
            return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
        }
        throw new Error("Модель ИИ не вернула изображение. Это может произойти, если запрос нарушает правила безопасности или слишком сложен.");
    });
};

export const generateEditedImage = (originalImage: File, userPrompt: string, maskImage: File): Promise<string> => {
    return executeApiCall('edit', async () => {
        const maskImagePart = await fileToPart(maskImage);
        const prompt = `# TASK: Masked Image Retouching
You are an expert AI photo editor. You are given an image, a mask, and a user instruction.

# INSTRUCTION
Perform the following edit: "${userPrompt}"

# RULES
1.  **Strict Mask Adherence:** Apply the edit ONLY to the white areas of the mask. The black areas of the mask MUST remain completely unchanged.
2.  **Seamless Integration:** The edited area must blend perfectly with the surrounding image. Match the original lighting, shadows, textures, grain, and perspective precisely.
3.  **Photorealism:** The result must be photorealistic and indistinguishable from a real photograph.
4.  **Output:** Output ONLY the final, edited image. Do not output text or explanations.`;
        return generateImageModification('edit', originalImage, [{ text: prompt }, maskImagePart]);
    });
};

export const generateTextEdit = (originalImage: File, prompt: string): Promise<string> => {
    const fullPrompt = `You are an expert AI photo editor. Perform the following edit on the provided image: "${prompt}". The change should be photorealistic and seamlessly integrated with the rest of the image. The output should be only the final, edited image.`;
    return generateImageModification('text edit', originalImage, [{ text: fullPrompt }]);
};

export const generateInpaintedImage = (originalImage: File, maskImage: File, fillPrompt?: string, editMode: boolean = false): Promise<string> => {
    const context = fillPrompt ? (editMode ? 'magic edit' : 'generative fill') : 'magic eraser';
    return executeApiCall(context, async () => {
        const maskImagePart = await fileToPart(maskImage);
        let prompt = '';
        
        if (fillPrompt) {
            if (editMode) {
                prompt = `# TASK: Masked Image Modification
You are an expert AI photo editor. You are given an image, a mask, and a user instruction. Your task is to **modify** the content within the white area of the mask according to the instruction.

# INSTRUCTION
"${fillPrompt}"

# RULES
1.  **Preserve Form:** Do not replace the object entirely. Modify its existing features (color, texture, details) as instructed. Preserve the object's underlying shape and form.
2.  **Strict Mask Adherence:** Apply the edit ONLY to the white areas of the mask. The black areas MUST remain unchanged.
3.  **Seamless Integration:** The edited area must blend perfectly with the surrounding image. Match the original lighting, shadows, grain, and perspective.
4.  **Photorealism:** The result must be photorealistic.
5.  **Output:** Output ONLY the final, edited image.`;
            } else {
                prompt = `# TASK: Generative Fill
You are provided an image, a mask, and a prompt. Replace the content within the white area of the mask with new content generated from the following description.

# PROMPT
"${fillPrompt}"

# RULES
1.  **Seamless Integration:** The generated content must blend perfectly into the original image, matching its lighting, perspective, shadows, and overall style.
2.  **Context Analysis:** Analyze the entire scene to ensure the generated content is plausible.
3.  **Boundary Adherence:** Do not change any part of the image outside the masked area.
4.  **Output:** Output only the final, edited image.`;
            }
        } else {
            prompt = `# TASK: Object Removal (Inpainting)
You are provided an image and a mask. The white area of the mask indicates an object to be completely removed. Your task is to perform an inpainting operation.

# RULES
1.  **Realistic Reconstruction:** Remove the content within the masked area and realistically reconstruct the background that should be behind it.
2.  **Pattern/Texture Matching:** Pay close attention to repeating patterns, textures, and lighting gradients in the surrounding area to ensure the filled region is indistinguishable from the original background.
3.  **Boundary Adherence:** Do not change any part of the image outside the masked area.
4.  **Output:** Output only the final, edited image.`;
        }
        
        return generateImageModification(context, originalImage, [{ text: prompt }, maskImagePart]);
    });
};

export const generateFaceSwap = (targetImage: File, referenceFaceImages: File[], maskImage: File, options: { expression: 'original' | 'reference'; blending: number }): Promise<string> => {
    return executeApiCall('face swap', async () => {
        const maskImagePart = await fileToPart(maskImage);
        const referenceFaceParts = await Promise.all(referenceFaceImages.map(fileToPart));
        let prompt = `You are an expert in photorealistic face swapping...`; // Keep the detailed prompt as is, it's specific.
        if (options.expression === 'original') prompt += ` It is crucial to preserve the original expression, lighting, shadows, and head angle from the target image.`;
        else prompt += ` Attempt to transfer the expression from the reference images onto the swapped face, while still matching the target image's lighting, shadows, and head angle.`;
        if (options.blending <= 33) prompt += ` Prioritize a seamless, natural blend...`;
        else if (options.blending >= 67) prompt += ` Prioritize a very strong and accurate likeness...`;
        else prompt += ` Find a good balance between matching the reference identity and creating a seamless, natural blend.`;
        prompt += ` ...Output only the final image.`;
        
        const allParts: Part[] = [{ text: prompt }, maskImagePart, ...referenceFaceParts];
        return generateImageModification('face swap', targetImage, allParts);
    });
};

export const generateStyledImage = (targetImage: File, referenceImages: File[]): Promise<string> => {
    return executeApiCall('style transfer', async () => {
        const referenceImageParts = await Promise.all(referenceImages.map(fileToPart));
        const prompt = `Apply the artistic style from the reference images to the primary target image. The primary target image is the one with the main subject and composition to be preserved. The other images provided are the style references. Do not change the content of the primary image, only its style. Output only the final stylized image.`;
        return generateImageModification('style transfer', targetImage, [{ text: prompt }, ...referenceImageParts]);
    });
};

export const generateAdjustedImage = (originalImage: File, adjustmentPrompt: string): Promise<string> => {
    const prompt = `Perform a global, photorealistic adjustment to the entire image based on this request: "${adjustmentPrompt}". Do not alter a person's identity or the core content. Output only the final adjusted image.`;
    return generateImageModification('adjustment', originalImage, [{ text: prompt }]);
};

export const generateFilteredImage = (originalImage: File, prompt: string): Promise<string> => {
    const fullPrompt = `You are an expert AI photo editor. Apply the following stylistic filter to the provided image: "${prompt}". The change should be applied globally, be photorealistic, and seamlessly integrated. The output should be only the final, edited image.`;
    return generateImageModification('filter', originalImage, [{ text: fullPrompt }]);
};

export const generateColorAdjustedImage = (originalImage: File, prompt: string): Promise<string> => {
    const fullPrompt = `${prompt}. Apply this adjustment photorealistically to the entire image. Output only the final adjusted image.`;
    return generateImageModification('color adjustment', originalImage, [{ text: fullPrompt }]);
};

export const generateReplacedBackground = (originalImage: File, backgroundPrompt: string): Promise<string> => {
    const prompt = `Identify the main subject and replace the background with this: "${backgroundPrompt}". The foreground subject must remain unchanged. Blend the new background naturally with the subject's lighting and edges. Output only the final image.`;
    return generateImageModification('background generation', originalImage, [{ text: prompt }]);
};

export const generateReplacedBackgroundFromImage = (originalImage: File, backgroundImage: File): Promise<string> => {
    return executeApiCall('background replacement from image', async () => {
        const backgroundImagePart = await fileToPart(backgroundImage);
        const prompt = `You are replacing the background of an image...`;
        return generateImageModification('background replacement from image', originalImage, [{ text: prompt }, backgroundImagePart]);
    });
};

export const generateClothingChange = (originalImage: File, clothingImage: File, prompt: string): Promise<string> => {
    return executeApiCall('clothing change', async () => {
        const clothingImagePart = await fileToPart(clothingImage);
        const fullPrompt = `You are performing a virtual try-on...: "${prompt}". ...Output only the final image.`;
        return generateImageModification('clothing change', originalImage, [{ text: fullPrompt }, clothingImagePart]);
    });
};

export const generateNewAngleImage = (originalImage: File, prompt: string, hotspot?: Hotspot): Promise<string> => {
    const fullPrompt = `# TASK: Camera Viewpoint Regeneration
Regenerate the provided image from a new camera viewpoint.

# Instruction
${prompt}

# Focal Point
The camera's movement MUST be centered around the point of interest located at approximately ${hotspot ? `${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top` : 'the center of the image'}. The main subject at this point must remain the focus.

# Critical Rules
1.  **Pure Orbital Rotation:** The movement MUST be a pure orbital rotation.
2.  **Constant Distance:** The distance between the camera and the focal point MUST remain constant.
3.  **No Zooming:** DO NOT change the zoom level.
4.  **Content Consistency:** All subjects, objects, and the overall style must remain perfectly consistent with the original.
5.  **Scene Generation:** Photorealistically generate any new parts of the scene that would become visible from the new angle.

# Output
Output ONLY the final, regenerated image.`;
    return generateImageModification('camera angle', originalImage, [{ text: fullPrompt }]);
};

export const generateExpandedImage = async (originalImage: File, direction: 'up' | 'down' | 'left' | 'right', percentage: number, prompt?: string): Promise<string> => {
    const { image: expandedImageDataUrl, mask: maskDataUrl } = await createExpandedCanvas(originalImage, direction, percentage);
    const expandedImageFile = dataURLtoFile(expandedImageDataUrl, 'expanded_base.png');
    const maskFile = dataURLtoFile(maskDataUrl, 'expand_mask.png');
    const fillPrompt = prompt
        ? `${prompt}, created as a seamless and realistic extension of the existing scene, perfectly matching its style, lighting, and perspective.`
        : 'a seamless and realistic extension of the existing scene, matching its style, lighting, and perspective.';
    return generateInpaintedImage(expandedImageFile, maskFile, fillPrompt);
};

export const generateUncroppedImage = async (originalImage: File, percentage: number, prompt?: string): Promise<string> => {
    const { image: expandedImageDataUrl, mask: maskDataUrl } = await createExpandedCanvas(originalImage, 'all', percentage);
    const expandedImageFile = dataURLtoFile(expandedImageDataUrl, 'uncropped_base.png');
    const maskFile = dataURLtoFile(maskDataUrl, 'uncrop_mask.png');
    const fillPrompt = prompt
        ? `${prompt}, created as a seamless and realistic extension of the centered scene on all sides, perfectly matching its style, lighting, and perspective.`
        : 'a seamless and realistic extension of the centered scene on all sides, matching its style, lighting, and perspective.';
    return generateInpaintedImage(expandedImageFile, maskFile, fillPrompt);
};

export const generateAddedPerson = (originalImage: File, personImage: File, prompt: string): Promise<string> => {
    return executeApiCall('add person', async () => {
        const personImagePart = await fileToPart(personImage);
        const fullPrompt = `You are an expert photo editor... instruction for placement: "${prompt}". ...Output must only be the edited main scene.`;
        return generateImageModification('add person', originalImage, [{ text: fullPrompt }, personImagePart]);
    });
};

export const generateAddedObjectFromText = (originalImage: File, prompt: string, hotspot: Hotspot, lighting?: string, shadows?: string): Promise<string> => {
    let integrationInstructions = `It must match the scale, perspective, lighting, and shadows of the scene to look realistic.`;
    if (lighting || shadows) {
        const instructions = [];
        if (lighting) instructions.push(`Lighting: "${lighting}".`);
        if (shadows) instructions.push(`Shadows: "${shadows}".`);
        integrationInstructions = `It must match the scale and perspective. ${instructions.join(' ')}`;
    }
    const fullPrompt = `Add this object: "${prompt}". Place it at the user-indicated point (~${hotspot.x.toFixed(1)}% from left, ~${hotspot.y.toFixed(1)}% from top). ${integrationInstructions} Output only the final image.`;
    return generateImageModification('add object', originalImage, [{ text: fullPrompt }]);
};

export const generateAddedObjectFromUpload = (originalImage: File, objectImage: File, hotspot: Hotspot, lighting?: string, shadows?: string): Promise<string> => {
    return executeApiCall('add object', async () => {
        const objectImagePart = await fileToPart(objectImage);
        let integrationInstructions = `ensuring it fits the scene's lighting, scale, and perspective.`;
        if (lighting || shadows) {
             const instructions = [];
             if (lighting) instructions.push(`Lighting: "${lighting}".`);
             if (shadows) instructions.push(`Shadows: "${shadows}".`);
             integrationInstructions = `ensuring it fits scale and perspective. ${instructions.join(' ')}`;
        }
        const fullPrompt = `Add the object from the reference photo into the main scene... at the user-indicated point (~${hotspot.x.toFixed(1)}% from left, ~${hotspot.y.toFixed(1)}% from top), ${integrationInstructions} Output only the final image.`;
        return generateImageModification('add object', originalImage, [{ text: fullPrompt }, objectImagePart]);
    });
};

export const generateEnhancedImage = (originalImage: File, prompt?: string): Promise<string> => {
    const finalPrompt = prompt
        ? `Perform the following enhancement to the entire image: "${prompt}". Maintain a photorealistic quality and do not alter the core subject or composition. Output only the final, enhanced image.`
        : `Enhance the overall quality of the image. Increase resolution and sharpness, reduce noise/grain, and subtly improve color and contrast without looking unnatural. Do not change the content. Output only the final, enhanced image.`;
    return generateImageModification('enhance', originalImage, [{ text: finalPrompt }]);
};

export const generateAreaEnhancement = (originalImage: File, prompt: string, hotspot: Hotspot): Promise<string> => {
    const fullPrompt = `Instruction: "${prompt}". The user has indicated a point of interest at approximately ${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top of the image. Perform the requested enhancement ONLY on the object/area at that location. The enhancement must blend perfectly with the rest of the image. Do not change any other part of the photo. Output only the final image.`;
    return generateImageModification('area enhancement', originalImage, [{ text: fullPrompt }]);
};

const executeJsonApiCall = async <T>(context: string, parts: Part[], responseSchema: object): Promise<T> => {
    return executeApiCall(context, async () => {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: { responseMimeType: "application/json", responseSchema },
        });

        try {
            const jsonStr = response.text.trim().replace(/^```json\s*|```$/g, '');
            return JSON.parse(jsonStr);
        } catch (parseError) {
            console.error(`Failed to parse JSON for ${context}:`, { responseText: response.text, parseError });
            throw new Error(`ИИ вернул неверный ответ для ${context}. Попробуйте еще раз.`);
        }
    });
};

export const analyzeStyleFromImages = async (styleImages: File[]): Promise<string> => {
    const imageParts = await Promise.all(styleImages.map(fileToPart));
    const prompt = `Analyze the provided images and describe their shared artistic style in a single, concise, descriptive sentence...`;
    const response = await executeJsonApiCall<{ description: string }>('style analysis', [ { text: prompt }, ...imageParts], {
        type: Type.OBJECT, properties: { description: { type: Type.STRING } }
    });
    return response.description;
};

export const detectFaces = async (originalImage: File): Promise<DetectedObject[]> => {
    const imagePart = await fileToPart(originalImage);
    const prompt = `You are a highly advanced image segmentation model. Your task is to analyze the provided image and identify ALL human faces...`;
    const schema = { type: Type.OBJECT, properties: { objects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, mask: { type: Type.STRING } }, required: ["name", "mask"] } } } };
    const result = await executeJsonApiCall<{ objects: any[] }>('face detection', [{ text: prompt }, imagePart], schema);
    return result.objects.map((obj, i) => ({ name: `Face ${i + 1}`, mask: `data:image/png;base64,${obj.mask}` }));
};

export const detectObjects = async (originalImage: File): Promise<DetectedObject[]> => {
    const imagePart = await fileToPart(originalImage);
    const prompt = `You are a highly advanced image segmentation model. Your task is to analyze the provided image and identify the most prominent and distinct objects...`;
    const schema = { type: Type.OBJECT, properties: { objects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, mask: { type: Type.STRING } }, required: ["name", "mask"] } } } };
    const result = await executeJsonApiCall<{ objects: any[] }>('object detection', [{ text: prompt }, imagePart], schema);
    return result.objects.map(obj => ({ name: obj.name, mask: `data:image/png;base64,${obj.mask}` }));
};

export const generateMixedImage = async (targetImage: File, itemImages: File[], prompt: string): Promise<string> => {
    return executeApiCall('mix & match', async () => {
        const itemImageParts = await Promise.all(itemImages.map(fileToPart));
        const fullPrompt = `You are an expert in photorealistic image composition... The user prompt is: "${prompt}". ...The final output must only be the edited target image.`;
        return generateImageModification('mix & match', targetImage, [{ text: fullPrompt }, ...itemImageParts]);
    });
};

export const generateBatchSuggestions = async (recipeSteps: string[]): Promise<string[]> => {
    const prompt = `You are an expert photo editing assistant... User's recipe steps: ${recipeSteps.join(', ')}. Provide 2-3 concise, helpful suggestions... Format as a JSON array of strings.`;
    return await executeJsonApiCall<string[]>('batch suggestions', [{ text: prompt }], { type: Type.ARRAY, items: { type: Type.STRING } });
};