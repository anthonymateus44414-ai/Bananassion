/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { Hotspot, DetectedObject } from '../types.ts';
import { createExpandedCanvas } from '../utils.ts';
import { dataURLtoFile } from '../utils.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
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
        throw new Error(`The AI returned an invalid response. Please try again.`);
    }
    // 1. Check for prompt blocking first (input validation)
    if (response.promptFeedback?.blockReason) {
        const { blockReason, safetyRatings } = response.promptFeedback;
        let userMessage: string;

        if (blockReason === 'SAFETY' || blockReason === 'PROHIBITED_CONTENT') {
             const specificReasons = safetyRatings?.filter(r => r.blocked).map(r => r.category.replace('HARM_CATEGORY_', '').toLowerCase()).join(', ');
             userMessage = `Your request was not processed due to safety filters${specificReasons ? ` related to: ${specificReasons}` : ''}. Please rephrase your prompt, avoiding potentially sensitive topics.`;
        } else { // Catches 'OTHER' and future block reasons
            userMessage = `Your request was blocked for an unspecified reason. Please try modifying your prompt or using a different image.`;
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
                userMessage = `Image generation was stopped due to safety concerns. Please try a different prompt or image.`;
                break;
            case 'RECITATION':
                userMessage = `Image generation was stopped to avoid reciting copyrighted material. Please try a more original prompt.`;
                break;
            case 'MAX_TOKENS':
                userMessage = `The request for '${context}' was too complex for the AI to process. Please try simplifying your prompt or using a smaller image area.`;
                break;
            default: // Catches 'OTHER' and any future reasons
                // This logic handles image processing errors, which often return 'OTHER'
                const multiImageContexts = ['face swap', 'clothing change', 'background replacement from image', 'add person', 'add object', 'mix & match', 'style transfer', 'edit', 'facial enhancement', 'color adjustment'];
                if (multiImageContexts.some(c => context === c)) {
                   userMessage = `The AI could not process one of the provided images (either the main image or a reference/style image). This can happen with unsupported formats or if an image is corrupted. Please try using different, clear images.`;
                } else {
                   userMessage = `The AI could not process the provided image. This can happen with unsupported formats or if the image is corrupted. Please try a different image.`;
                }
                break;
        }

        console.error(`Image generation failed during ${context}. Reason: ${finishReason}`, { finishMessage, response });
        throw new Error(userMessage);
    }
    
    // 4. Fallback error if no image and no other specific failure reason is found
    const textFeedback = response.text?.trim();
    const errorMessage = textFeedback
        ? `The AI responded with text instead of an image for '${context}': "${textFeedback}". Please try rephrasing your prompt to be more specific about the visual change you want.`
        : `The AI model did not return an image for '${context}'. This can happen if the request is too complex or ambiguous. Please try rephrasing your prompt.`;

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

const GENERIC_API_ERROR_MESSAGE = 'Failed to communicate with the AI service. Please check your internet connection and try again.';

// Helper to check if an error message is one of our custom, user-friendly messages.
const isCustomError = (message: string) => {
    return message && (
        message.startsWith('Your request was') ||
        message.startsWith('Image generation was stopped') ||
        message.startsWith("The request for '") ||
        message.startsWith('The AI could not process') ||
        message.startsWith('The AI stopped generating') ||
        message.startsWith('The AI responded with text') ||
        message.startsWith('The AI returned an invalid response') ||
        message.startsWith('The AI model did not return an image') ||
        message.startsWith('This AI feature is unfortunately not available') ||
        message.startsWith('The provided API key is invalid') ||
        message.startsWith('The AI was unable to generate')
    );
}

const handleApiError = (err: any, context: string): Error => {
    console.error(`Error during ${context}:`, err);

    // If it's one of our pre-formatted user-friendly errors, just return it.
    if (err instanceof Error && isCustomError(err.message)) {
        return err;
    }

    let specificMessage = '';
    let rawError = err;

    // Dig for the actual error object if it's nested
    if (err.error) rawError = err.error;
    if (err.response?.data) rawError = err.response.data;

    // Try to parse the message if it's a JSON string
    if (typeof rawError.message === 'string' && rawError.message.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(rawError.message);
            // If parsing succeeds, replace rawError with the parsed object
            // to check for nested 'error.message'
            rawError = parsed;
        } catch { /* ignore parsing errors */ }
    }
    
    // Extract the message from the most likely location
    if (typeof rawError.error?.message === 'string') {
        specificMessage = rawError.error.message; // Standard Google API format
    } else if (typeof rawError.message === 'string') {
        specificMessage = rawError.message;
    } else if (typeof err.message === 'string') {
        specificMessage = err.message; // Fallback to the original top-level message
    } else {
        // As a last resort, stringify the whole thing
        try {
            const str = JSON.stringify(err);
            specificMessage = str === '{}' ? 'An unknown error occurred.' : str;
        } catch {
            specificMessage = 'An unknown and un-stringifiable error occurred.';
        }
    }
    
    // Check for known API issues and create a user-friendly message.
    if (specificMessage.includes('Image generation is not available in your country')) {
        return new Error('This AI feature is unfortunately not available in your region due to local restrictions.');
    }
    if (specificMessage.includes('API key not valid')) {
        return new Error('The provided API key is invalid. Please check your configuration.');
    }
    if (specificMessage.toUpperCase().includes('SAFETY') || specificMessage.toUpperCase().includes('PROHIBITED_CONTENT')) {
        return new Error(`Your request for '${context}' was blocked due to safety filters. Please adjust your prompt or use a different image.`);
    }

    // If it's a specific message from the API but not one we've customized, show it, but keep it brief.
    if (specificMessage && specificMessage.length > 1 && !isCustomError(specificMessage)) {
        // Final check to avoid showing raw JSON to the user
        if (specificMessage.trim().startsWith('{')) {
            return new Error('The AI service returned an unexpected response. Please try again.');
        }
        return new Error(`The AI service reported an error: ${specificMessage}`);
    }

    // Default generic error.
    return new Error(GENERIC_API_ERROR_MESSAGE);
};


/**
 * A centralized wrapper for all API calls to ensure consistent error handling.
 * @param context A string describing the operation for clear error messages.
 * @param apiCall The async function that makes the actual API call.
 * @returns A promise that resolves with the API call's successful result.
 */
async function executeApiCall<T>(context: string, apiCall: () => Promise<T>): Promise<T> {
    try {
        return await apiCall();
    } catch (err: any) {
        throw handleApiError(err, context);
    }
}

/**
 * Generates an image from a text prompt using generative AI.
 * @param prompt The text prompt describing the desired image.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const generateImageFromPrompt = async (
    prompt: string,
): Promise<string> => {
    return executeApiCall('image generation from prompt', async () => {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            console.log('Received image data for generation');
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }

        throw new Error("The AI model did not return an image. This can happen if the request violates safety policies or is too complex. Please try rephrasing your prompt to be more descriptive and specific.");
    });
};

/**
 * Generates an edited image using generative AI based on a text prompt and a mask.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param maskImage The mask image file where white indicates the area to edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    maskImage: File
): Promise<string> => {
    return executeApiCall('edit', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const maskImagePart = await fileToPart(maskImage);
        
        const prompt = `You are given an image and a mask. Perform the following edit on the image: "${userPrompt}". Apply the edit ONLY to the white areas of the mask. Black areas must remain unchanged. Ensure a photorealistic and seamless blend. Output only the final image.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, maskImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'edit');
    });
};

/**
 * Generates a new image by applying a text-based edit to the entire original image.
 * @param originalImage The original image file.
 * @param prompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateTextEdit = async (
    originalImage: File,
    prompt: string,
): Promise<string> => {
    return executeApiCall('text edit', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const fullPrompt = `You are an expert AI photo editor. Perform the following edit on the provided image: "${prompt}". The change should be photorealistic and seamlessly integrated with the rest of the image. The output should be only the final, edited image.`;
        const textPart = { text: fullPrompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'text edit');
    });
};

/**
 * Removes or replaces content from a masked area of an image using generative AI.
 * @param originalImage The original image file.
 * @param maskImage The mask image file where white indicates the area to edit.
 * @param fillPrompt Optional prompt to describe what to generate in the masked area.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateInpaintedImage = async (
    originalImage: File,
    maskImage: File,
    fillPrompt?: string,
): Promise<string> => {
    const context = fillPrompt ? 'generative fill' : 'magic eraser';
    return executeApiCall(context, async () => {
        const originalImagePart = await fileToPart(originalImage);
        const maskImagePart = await fileToPart(maskImage);
        
        const prompt = fillPrompt
          ? `You are provided an image, a mask, and a prompt. Replace the content within the white area of the mask with a new image generated from the following description: "${fillPrompt}". The generated content must seamlessly blend into the original image, matching its lighting, perspective, shadows, and overall style. Analyze the overall scene to ensure the generated content is plausible in its context. Do not change any part of the image outside the masked area. Output only the final image.`
          : `You are provided an image and a mask. The white area of the mask indicates an object or region to be completely removed. Your task is to perform an inpainting operation. Remove the content within the masked area and realistically reconstruct the background that should be behind it. Pay close attention to repeating patterns, textures, and lighting gradients in the surrounding area to ensure the filled region is indistinguishable from the original background. The final result must be a photorealistic image where the object has vanished, and the background is seamlessly filled in. Do not change any part of the image outside the masked area. Output only the final image.`;
        
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, maskImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, context);
    });
};

/**
 * Swaps a face in a target image with a face from reference images.
 * @param targetImage The image where the face will be swapped.
 * @param referenceFaceImages An array of images of the new face.
 * @param maskImage A mask file indicating which face to replace in the target image.
 * @param options Advanced options for controlling the swap.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateFaceSwap = async (
    targetImage: File,
    referenceFaceImages: File[],
    maskImage: File,
    options: { expression: 'original' | 'reference'; blending: number }
): Promise<string> => {
    return executeApiCall('face swap', async () => {
        const targetImagePart = await fileToPart(targetImage);
        const maskImagePart = await fileToPart(maskImage);
        const referenceFaceParts = await Promise.all(referenceFaceImages.map(file => fileToPart(file)));

        // Dynamic prompt construction
        let prompt = `You are an expert in photorealistic face swapping. You are given a target image, a mask indicating a specific face, and one or more reference images of a new face. Your task is to replace the face within the masked area of the target image with the face from the reference images.`;

        if (options.expression === 'original') {
            prompt += ` It is crucial to preserve the original expression, lighting, shadows, and head angle from the target image.`;
        } else {
            prompt += ` Attempt to transfer the expression from the reference images onto the swapped face, while still matching the target image's lighting, shadows, and head angle.`;
        }

        if (options.blending <= 33) {
            prompt += ` Prioritize a seamless, natural blend with the original skin tone and facial structure, even if it means a slightly less exact match to the reference identity.`;
        } else if (options.blending >= 67) {
            prompt += ` Prioritize a very strong and accurate likeness to the reference identity, ensuring the final face is clearly recognizable as the person from the reference photos.`;
        } else {
            prompt += ` Find a good balance between matching the reference identity and creating a seamless, natural blend.`;
        }
        
        prompt += ` The result must be a high-quality composite that looks completely natural. Do not alter the background or any other part of the target image outside the mask. Output only the final image.`;
        
        const textPart = { text: prompt };
        const allParts = [textPart, targetImagePart, maskImagePart, ...referenceFaceParts];

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'face swap');
    });
};

/**
 * Generates an image with a new style based on reference images.
 * @param targetImage The image to apply the style to.
 * @param referenceImages The images defining the style.
 * @returns A promise that resolves to the data URL of the stylized image.
 */
export const generateStyledImage = async (
    targetImage: File,
    referenceImages: File[],
): Promise<string> => {
    return executeApiCall('style transfer', async () => {
        const targetImagePart = await fileToPart(targetImage);
        const referenceImageParts = await Promise.all(referenceImages.map(file => fileToPart(file)));

        const prompt = `Apply the artistic style from the reference images to the primary target image. The primary target image is the one with the main subject and composition to be preserved. The other images provided are the style references. Do not change the content of the primary image, only its style. Output only the final stylized image.`;
        const textPart = { text: prompt };
        const allParts = [textPart, targetImagePart, ...referenceImageParts];

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'style transfer');
    });
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    return executeApiCall('adjustment', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `Perform a global, photorealistic adjustment to the entire image based on this request: "${adjustmentPrompt}". Do not alter a person's identity or the core content. Output only the final adjusted image.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'adjustment');
    });
};

// FIX: Added generateFilteredImage to support the batch editor's filter functionality.
/**
 * Applies a stylistic filter to an image using a text prompt.
 * @param originalImage The original image file.
 * @param prompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    prompt: string,
): Promise<string> => {
    return executeApiCall('filter', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const fullPrompt = `You are an expert AI photo editor. Apply the following stylistic filter to the provided image: "${prompt}". The change should be applied globally, be photorealistic, and seamlessly integrated. The output should be only the final, edited image.`;
        const textPart = { text: fullPrompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'filter');
    });
};

// FIX: Added generateColorAdjustedImage to support the batch editor's color functionality.
/**
 * Applies color adjustments to an image using a text prompt.
 * @param originalImage The original image file.
 * @param prompt A prompt describing the color changes (e.g., "Hue: +10, Saturation: -20").
 * @returns A promise that resolves to the data URL of the color-adjusted image.
 */
export const generateColorAdjustedImage = async (
    originalImage: File,
    prompt: string,
): Promise<string> => {
    return executeApiCall('color adjustment', async () => {
        const originalImagePart = await fileToPart(originalImage);
        // The prompt from ColorPanel is already well-formed, e.g., "Apply the following adjustments: Hue: +20, Saturation: -15."
        const fullPrompt = `${prompt}. Apply this adjustment photorealistically to the entire image. Output only the final adjusted image.`;
        const textPart = { text: fullPrompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'color adjustment');
    });
};

/**
 * Replaces the background of an image using generative AI.
 * @param originalImage The original image file.
 * @param backgroundPrompt The text prompt describing the new background.
 * @returns A promise that resolves to the data URL of the image with the new background.
 */
export const generateReplacedBackground = async (
    originalImage: File,
    backgroundPrompt: string,
): Promise<string> => {
    return executeApiCall('background generation', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `Identify the main subject and replace the background with this: "${backgroundPrompt}". The foreground subject must remain unchanged. Blend the new background naturally with the subject's lighting and edges. Output only the final image.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'background generation');
    });
};

/**
 * Replaces the background of an image with another image.
 * @param originalImage The original image file with the subject.
 * @param backgroundImage The image file to use as the new background.
 * @returns A promise that resolves to the data URL of the image with the new background.
 */
export const generateReplacedBackgroundFromImage = async (
    originalImage: File,
    backgroundImage: File,
): Promise<string> => {
    return executeApiCall('background replacement from image', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const backgroundImagePart = await fileToPart(backgroundImage);
        const prompt = `You are replacing the background of an image. The primary image contains the subject to be preserved. The second image is the new background. Isolate the subject from the primary image and place it onto the new background, ensuring a realistic blend of lighting and edges. Output only the final composite image.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, backgroundImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'background replacement from image');
    });
};

/**
 * Changes the clothing on a person in an image based on a reference clothing image.
 * @param originalImage The image of the person to edit.
 * @param clothingImage The image of the clothing item.
 * @param prompt A prompt describing the desired change.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateClothingChange = async (
    originalImage: File,
    clothingImage: File,
    prompt: string,
): Promise<string> => {
    return executeApiCall('clothing change', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const clothingImagePart = await fileToPart(clothingImage);
        
        const fullPrompt = `You are performing a virtual try-on. The primary image contains a person. The second image is an item of clothing. Replace the existing clothing on the person with the item from the second image, guided by the instruction: "${prompt}". The new clothing must fit the person's body and pose realistically, matching the photo's lighting. Do not change the person or the background. Output only the final image.`;
        const textPart = { text: fullPrompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, clothingImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'clothing change');
    });
};

/**
 * Regenerates an image from a new camera angle.
 * @param originalImage The original image file.
 * @param prompt A prompt describing the new camera angle.
 * @param hotspot Optional point of interest to be the center of the camera movement.
 * @returns A promise that resolves to the data URL of the new image.
 */
export const generateNewAngleImage = async (
    originalImage: File,
    prompt: string,
    hotspot?: Hotspot
): Promise<string> => {
    return executeApiCall('camera angle', async () => {
        const originalImagePart = await fileToPart(originalImage);
        
        let fullPrompt: string;
        
        // Check if the prompt is for orbital rotation by looking for the specific phrase
        const angleMatch = prompt.match(/new yaw angle of (-?\d+(\.\d+)?)/);

        if (angleMatch) {
            // PROMPT FOR ORBITAL ROTATION
            const angle = angleMatch[1];
            fullPrompt = `You are a virtual 3D camera operator. Your task is to re-render a scene from a new viewpoint. Follow these instructions precisely.

**Camera Operation:**
*   **Type:** Horizontal Orbital Rotation (Yaw).
*   **Target Yaw Angle:** ${angle} degrees relative to the current view (which is 0 degrees). A positive angle means rotating to the right (clockwise), and a negative angle means rotating to the left (counter-clockwise).
*   **Focal Point (Center of Orbit):** A point located at approximately ${hotspot ? `${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top` : 'the center of the image'}.

**Execution Constraints (MANDATORY):**
1.  **Maintain Orbit:** The camera MUST physically move along a circular path (orbit) around the specified focal point. The distance from the camera to the focal point must not change.
2.  **No Pitch or Roll:** The camera's vertical angle (pitch) and tilt (roll) MUST remain zero. The horizon line must stay level.
3.  **No Zoom:** The camera's field of view (zoom) MUST NOT change.
4.  **Preserve Scene Integrity:** All objects, characters, lighting, and the overall artistic style must be perfectly preserved, just viewed from the new angle.
5.  **Generate Occluded Areas:** Photorealistically generate any parts of the scene that were previously hidden (occluded) and are now visible from the new camera position.

**Output:**
Provide ONLY the final rendered image. No text, no explanations.`;
        } else {
            // GENERIC PROMPT FOR OTHER CAMERA MOVEMENTS (LIKE ZOOM)
            fullPrompt = `You are an expert in photorealistic scene regeneration. Your task is to regenerate the provided image from a new camera viewpoint.

**Instruction:**
${prompt}

**Focal Point:**
The camera's movement must be centered around the point of interest located at approximately ${hotspot ? `${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top` : 'the center of the image'}. The main subject at this point must remain the focus of the new viewpoint.

**Critical Rules:**
1.  **Maintain Focal Point:** Keep the specified focal point as the center of the action.
2.  **Consistency:** Keep all subjects, objects, and the overall style of the original image perfectly consistent.
3.  **Generation:** Photorealistically generate any new parts of the scene that would become visible from the new viewpoint.

**Output:**
Output ONLY the final, regenerated image. Do not include any text, titles, or other information.`;
        }

        const textPart = { text: fullPrompt };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'camera angle');
    });
};

/**
 * Expands an image in a specific direction.
 * @param originalImage The original image file.
 * @param direction The direction to expand ('up', 'down', 'left', 'right').
 * @param percentage The percentage to expand by (e.g., 50).
 * @returns A promise that resolves to the data URL of the expanded image.
 */
export const generateExpandedImage = async (
    originalImage: File,
    direction: 'up' | 'down' | 'left' | 'right',
    percentage: number,
): Promise<string> => {
    let expandedImageFile: File, maskFile: File;
    try {
        const { image: expandedImageDataUrl, mask: maskDataUrl } = await createExpandedCanvas(originalImage, direction, percentage);
        expandedImageFile = dataURLtoFile(expandedImageDataUrl, 'expanded_base.png');
        maskFile = dataURLtoFile(maskDataUrl, 'expand_mask.png');
    } catch (err) {
        console.error('Error during image expansion canvas creation:', err);
        throw new Error('Failed to prepare the canvas for image expansion. The source image might be invalid.');
    }

    const fillPrompt = 'a seamless and realistic extension of the existing scene, matching its style, lighting, and perspective.';
    return await generateInpaintedImage(expandedImageFile, maskFile, fillPrompt);
};

/**
 * Expands an image on all sides ('uncrops' it).
 * @param originalImage The original image file.
 * @param percentage The percentage to expand by on all sides.
 * @returns A promise that resolves to the data URL of the uncropped image.
 */
export const generateUncroppedImage = async (
    originalImage: File,
    percentage: number,
): Promise<string> => {
    let expandedImageFile: File, maskFile: File;
    try {
        const { image: expandedImageDataUrl, mask: maskDataUrl } = await createExpandedCanvas(originalImage, 'all', percentage);
        expandedImageFile = dataURLtoFile(expandedImageDataUrl, 'uncropped_base.png');
        maskFile = dataURLtoFile(maskDataUrl, 'uncrop_mask.png');
    } catch (err: any) {
        console.error('Error during image uncropping canvas creation:', err);
        throw new Error('Failed to prepare the canvas for uncropping. The source image might be invalid.');
    }

    const fillPrompt = 'a seamless and realistic extension of the centered scene on all sides, matching its style, lighting, and perspective.';
    return await generateInpaintedImage(expandedImageFile, maskFile, fillPrompt);
};

/**
 * Adds a person from a reference image into the main image.
 * @param originalImage The main scene.
 * @param personImage The image of the person to add.
 * @param prompt A prompt describing placement.
 * @returns A promise that resolves to the data URL of the combined image.
 */
export const generateAddedPerson = async (
    originalImage: File,
    personImage: File,
    prompt: string,
): Promise<string> => {
    return executeApiCall('add person', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const personImagePart = await fileToPart(personImage);
        
        const fullPrompt = `You are an expert photo editor. Your task is to realistically composite a person from a reference image into a main scene. The first image provided is the main scene. The second image is the reference photo containing the person to be added. Follow the user's instruction for placement: "${prompt}". You must isolate the person from their background in the reference photo and seamlessly blend them into the main scene, matching the lighting, scale, shadows, and perspective. The final output must only be the edited main scene.`;
        const textPart = { text: fullPrompt };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, personImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'add person');
    });
};

/**
 * Adds an object into an image based on a text prompt and a location.
 * @param originalImage The main scene.
 * @param prompt A prompt describing the object.
 * @param hotspot The location to add the object.
 * @param lighting Optional instructions for lighting.
 * @param shadows Optional instructions for shadows.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateAddedObjectFromText = async (
    originalImage: File,
    prompt: string,
    hotspot: Hotspot,
    lighting?: string,
    shadows?: string,
): Promise<string> => {
    return executeApiCall('add object', async () => {
        const originalImagePart = await fileToPart(originalImage);

        const defaultIntegration = `It must match the scale, perspective, lighting, and shadows of the scene to look realistic.`;
        let customIntegration = '';
        if (lighting || shadows) {
            const instructions: string[] = [];
            if (lighting) instructions.push(`Lighting must follow this instruction: "${lighting}".`);
            if (shadows) instructions.push(`Shadows must follow this instruction: "${shadows}".`);
            customIntegration = `It must match the scale and perspective of the scene. ${instructions.join(' ')}`;
        }
        const integrationInstructions = customIntegration || defaultIntegration;

        const fullPrompt = `Add this object: "${prompt}". Place the generated object into the image at the user-indicated point (approximately ${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top). ${integrationInstructions} Output only the final image.`;
        const textPart = { text: fullPrompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'add object');
    });
};

/**
 * Adds an object from a reference image into the main image.
 * @param originalImage The main scene.
 * @param objectImage The image of the object to add.
 * @param hotspot The location to add the object.
 * @param lighting Optional instructions for lighting.
 * @param shadows Optional instructions for shadows.
 * @returns A promise that resolves to the data URL of the combined image.
 */
export const generateAddedObjectFromUpload = async (
    originalImage: File,
    objectImage: File,
    hotspot: Hotspot,
    lighting?: string,
    shadows?: string,
): Promise<string> => {
    return executeApiCall('add object', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const objectImagePart = await fileToPart(objectImage);
        
        const defaultIntegration = `ensuring it fits the scene's lighting, scale, and perspective.`;
        let customIntegration = '';
        if (lighting || shadows) {
            const instructions = [];
            if (lighting) instructions.push(`Lighting must follow this instruction: "${lighting}".`);
            if (shadows) instructions.push(`Shadows must follow this instruction: "${shadows}".`);
            customIntegration = `ensuring it fits the scene's scale and perspective. ${instructions.join(' ')}`;
        }
        const integrationInstructions = customIntegration || defaultIntegration;
        
        const fullPrompt = `You are given a main scene image and a reference photo of an object. Add the object from the reference photo into the main scene. Isolate the object from its background and place it at the user-indicated point (approximately ${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top), ${integrationInstructions} Output only the final image.`;
        const textPart = { text: fullPrompt };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart, objectImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'add object');
    });
};

/**
 * Enhances the entire image.
 * @param originalImage The image to enhance.
 * @param prompt An optional prompt describing the specific enhancement.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generateEnhancedImage = async (originalImage: File, prompt?: string): Promise<string> => {
    return executeApiCall('enhance', async () => {
        const originalImagePart = await fileToPart(originalImage);
        
        const finalPrompt = prompt
            ? `Perform the following enhancement to the entire image: "${prompt}". Maintain a photorealistic quality and do not alter the core subject or composition. Output only the final, enhanced image.`
            : `Enhance the overall quality of the image. Increase resolution and sharpness, reduce noise/grain, and subtly improve color and contrast without looking unnatural. Do not change the content. Output only the final, enhanced image.`;

        const textPart = { text: finalPrompt };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'enhance');
    });
};


/**
 * Enhances a specific area of an image.
 * @param originalImage The image to edit.
 * @param prompt A prompt describing the enhancement.
 * @param hotspot The location to enhance.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateAreaEnhancement = async (
    originalImage: File,
    prompt: string,
    hotspot: Hotspot,
): Promise<string> => {
     return executeApiCall('area enhancement', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const fullPrompt = `Instruction: "${prompt}". The user has indicated a point of interest at approximately ${hotspot.x.toFixed(1)}% from the left and ${hotspot.y.toFixed(1)}% from the top of the image. Perform the requested enhancement ONLY on the object/area at that location. The enhancement must blend perfectly with the rest of the image. Do not change any other part of the photo. Output only the final image.`;
        const textPart = { text: fullPrompt };
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'area enhancement');
    });
};

/**
 * Analyzes a set of images to generate a style description.
 * @param styleImages An array of files that define a style.
 * @returns A promise that resolves to a string describing the style.
 */
export const analyzeStyleFromImages = async (
    styleImages: File[],
): Promise<string> => {
    return executeApiCall('style analysis', async () => {
        const imageParts = await Promise.all(styleImages.map(file => fileToPart(file)));
        const prompt = `Analyze the provided images and describe their shared artistic style in a single, concise, descriptive sentence. Focus on color palette, lighting, texture, and mood. The description should be suitable to be used as a prompt for another AI to replicate this style. Do not use markdown.

Example output: "A moody, high-contrast black and white film noir style with deep shadows and dramatic, cinematic lighting."`;
        const textPart = { text: prompt };
        const allParts = [textPart, ...imageParts];
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: allParts },
        });

        const text = response.text?.trim();
        if (!text) {
            console.error("AI did not provide a style description in its response.", { response });
            throw new Error("The AI was unable to generate a style description from the provided images. Please try again with a different set of images.");
        }
        return text;
    });
};

/**
 * Detects and segments faces in an image.
 * @param originalImage The image to analyze.
 * @returns A promise that resolves to an array of detected faces with their masks.
 */
export const detectFaces = async (
    originalImage: File,
): Promise<DetectedObject[]> => {
    return executeApiCall('face detection', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are a highly advanced image segmentation model. Your task is to analyze the provided image and identify ALL human faces. For each identified face, you must:
1. Provide a generic "name" for the face (e.g., "Face 1", "Face 2").
2. Generate a precise, pixel-perfect segmentation "mask". The mask must be a PNG image of the exact same dimensions as the original input image. The mask should be white (#FFFFFF) for every pixel belonging to the face and black (#000000) for all other pixels.
3. Encode this PNG mask image into a Base64 string.

Return a JSON object containing a single key "objects", which is an array of the identified faces. If no faces are found, return an empty array. Do not include any other text or markdown in your response.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        objects: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    mask: { type: Type.STRING }
                                },
                                required: ["name", "mask"]
                            }
                        }
                    }
                }
            }
        });

        let result;
        try {
            const jsonStr = response.text.trim();
            const cleanedJsonStr = jsonStr.replace(/^```json\s*|```$/g, '');
            result = JSON.parse(cleanedJsonStr);
        } catch (parseError) {
            console.error('Failed to parse JSON response from AI for face detection:', { responseText: response.text, parseError });
            throw new Error("The AI returned an invalid response for face detection. Please try again.");
        }

        if (result && Array.isArray(result.objects)) {
            return result.objects.map((obj: any, index: number) => ({
                name: `Face ${index + 1}`,
                mask: `data:image/png;base64,${obj.mask}`
            }));
        }
        
        throw new Error("AI response was not in the expected format for face detection.");
    });
};

/**
 * Detects and segments distinct objects in an image.
 * @param originalImage The image to analyze.
 * @returns A promise that resolves to an array of detected objects with their masks.
 */
export const detectObjects = async (
    originalImage: File,
): Promise<DetectedObject[]> => {
    return executeApiCall('object detection', async () => {
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are a highly advanced image segmentation model. Your task is to analyze the provided image and identify the most prominent and distinct objects. For each identified object, you must:
1. Provide a concise "name" for the object (e.g., "Red Car", "Person's Shirt", "Dog").
2. Generate a precise, pixel-perfect segmentation "mask". The mask must be a PNG image of the exact same dimensions as the original input image. The mask should be white (#FFFFFF) for every pixel belonging to the object and black (#000000) for all other pixels.
3. Encode this PNG mask image into a Base64 string.

Return a JSON object containing a single key "objects", which is an array of the identified objects. If no distinct objects are found, return an empty array. Do not include any other text or markdown in your response.`;
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, originalImagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        objects: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    mask: { type: Type.STRING }
                                },
                                required: ["name", "mask"]
                            }
                        }
                    }
                }
            }
        });

        let result;
        try {
            const jsonStr = response.text.trim();
            const cleanedJsonStr = jsonStr.replace(/^```json\s*|```$/g, '');
            result = JSON.parse(cleanedJsonStr);
        } catch (parseError) {
            console.error('Failed to parse JSON response from AI for object detection:', { responseText: response.text, parseError });
            throw new Error("The AI returned an invalid response for object detection. Please try again.");
        }

        if (result && Array.isArray(result.objects)) {
            return result.objects.map((obj: any) => ({
                name: obj.name,
                mask: `data:image/png;base64,${obj.mask}`
            }));
        }
        
        throw new Error("AI response was not in the expected format for object detection.");
    });
};

/**
 * Composites multiple item images onto a target image based on a prompt.
 * @param targetImage The base image.
 * @param itemImages An array of item images to add.
 * @param prompt The prompt describing how to combine them.
 * @returns A promise that resolves to the data URL of the final image.
 */
export const generateMixedImage = async (
    targetImage: File,
    itemImages: File[],
    prompt: string,
): Promise<string> => {
    return executeApiCall('mix & match', async () => {
        const targetImagePart = await fileToPart(targetImage);
        const itemImageParts = await Promise.all(itemImages.map(file => fileToPart(file)));

        const fullPrompt = `You are an expert in photorealistic image composition. You are given a primary target image and a set of reference images containing items. Your task is to follow the user's prompt to composite the items from the reference images onto the target image. The user prompt is: "${prompt}". Isolate the items from their backgrounds in the reference photos and seamlessly blend them into the target image, matching the lighting, scale, shadows, and perspective. The final output must only be the edited target image.`;
        const textPart = { text: fullPrompt };
        const allParts = [textPart, targetImagePart, ...itemImageParts];

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        return handleApiResponse(response, 'mix & match');
    });
};

/**
 * Generates suggestions for a batch processing recipe.
 * @param recipeSteps An array of strings describing the recipe.
 * @returns A promise that resolves to an array of suggestion strings.
 */
export const generateBatchSuggestions = async (
    recipeSteps: string[],
): Promise<string[]> => {
    return executeApiCall('batch suggestions', async () => {
        const prompt = `You are an expert photo editing assistant. A user has created a batch processing "recipe" with the following steps: ${recipeSteps.join(', ')}.

Based on this recipe, provide 2-3 concise, helpful suggestions for other adjustments or considerations the user might find useful. Frame your suggestions as positive tips. Format the response as a JSON array of strings.

Example Input: ["Filter: Cinematic", "Adjust: Blur Background"]
Example Output:
[
  "Consider adding a 'Lens Flare' adjustment to enhance the cinematic feel.",
  "For portraits, a 'Facial: Brighten Eyes' step can make the subject stand out even more.",
  "If the colors feel too strong, try slightly decreasing saturation with the Color tool."
]`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING
                    }
                }
            }
        });

        let suggestions;
        try {
            const jsonStr = response.text.trim();
            const cleanedJsonStr = jsonStr.replace(/^```json\s*|```$/g, '');
            suggestions = JSON.parse(cleanedJsonStr);
        } catch (parseError) {
            console.error('Failed to parse JSON response from AI for batch suggestions:', { responseText: response.text, parseError });
            throw new Error("The AI returned an invalid response. Please try again.");
        }

        if (!Array.isArray(suggestions)) {
            throw new Error("AI response was not a valid array.");
        }
        return suggestions.slice(0, 3); // Max 3 suggestions
    });
};