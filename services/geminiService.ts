/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { Hotspot } from '../types';

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
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, safetyRatings } = response.promptFeedback;
        let userMessage = `Your request was blocked. Reason: ${blockReason}.`;

        if (blockReason === 'SAFETY' || blockReason === 'PROHIBITED_CONTENT') {
             const specificReasons = safetyRatings?.filter(r => r.blocked).map(r => r.category.replace('HARM_CATEGORY_', '').toLowerCase()).join(', ');
             userMessage = `Your request could not be processed due to safety filters${specificReasons ? ` related to: ${specificReasons}` : ''}. Please try rephrasing your prompt to be more descriptive and less ambiguous, while avoiding potentially sensitive topics.`;
        } else if (blockReason === 'OTHER') {
            userMessage = 'Your request was blocked for an unspecified reason. Please try modifying your prompt or using a different image.';
        }
        
        console.error(userMessage, { response });
        throw new Error(userMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        let userMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}.`;
        
        if (finishReason === 'SAFETY') {
            userMessage = 'The AI stopped generating the image due to safety concerns. Please try rephrasing your prompt to be more descriptive and less ambiguous.';
        } else if (finishReason === 'RECITATION') {
             userMessage = 'The AI stopped generating the image to avoid reciting copyrighted material. Please try a more original prompt.';
        } else {
             userMessage = `The AI stopped generating the image unexpectedly. This can sometimes happen with very complex requests. Please try simplifying your prompt.`;
        }

        console.error(userMessage, { response });
        throw new Error(userMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text instead: "${textFeedback}" Please try rephrasing your prompt to be more specific about the visual change you want.`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct and descriptive.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

const GENERIC_API_ERROR_MESSAGE = 'Failed to communicate with the AI service. Please check your internet connection and try again.';

// Helper to check if an error message is one of our custom, user-friendly messages.
const isCustomError = (message: string) => {
    return message.startsWith('Your request was blocked') || message.startsWith('The AI model did not return an image') || message.startsWith('Image generation for');
}

/**
 * Generates an image from a text prompt using generative AI.
 * @param prompt The text prompt describing the desired image.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const generateImageFromPrompt = async (
    prompt: string,
): Promise<string> => {
    try {
        console.log(`Starting image generation for prompt: "${prompt}"`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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

    } catch(err: any) {
        console.error("Error during image generation API call:", err);
        if (err.message.includes('The AI model did not return an image')) {
            throw err;
        }
        throw new Error('Image generation failed. This could be due to a network issue or a problem with the AI service. Please try again shortly.');
    }
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
    try {
        console.log('Starting generative masked edit.');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const maskImagePart = await fileToPart(maskImage);

        const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on a user's request and a mask image.

User Request: "${userPrompt}"

**CRITICAL INSTRUCTIONS:**
1.  **Use the Mask**: You have been given two images. The first is the original photo. The second is a black and white mask.
2.  **Apply Edit to White Area**: You MUST apply the user's requested edit ONLY to the areas of the photo that correspond to the WHITE parts of the mask image.
3.  **Do Not Touch Black Area**: The areas of the photo corresponding to the BLACK parts of the mask image must remain completely unchanged and identical to the original.
4.  **Seamless Blending**: The edit must be realistic and blend seamlessly with the surrounding, unedited area.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image, mask, and prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, maskImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model.', response);

        return handleApiResponse(response, 'masked edit');
    } catch (err: any) {
        console.error('Error during generative masked edit:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates a facial enhancement using generative AI based on a text prompt and a mask.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired enhancement.
 * @param maskImage The mask image file where white indicates the area to edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateFacialEnhancement = async (
    originalImage: File,
    userPrompt: string,
    maskImage: File
): Promise<string> => {
    try {
        console.log('Starting generative facial enhancement.');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const maskImagePart = await fileToPart(maskImage);

        const prompt = `You are an expert AI photo retoucher specializing in natural facial enhancements. Your task is to perform a subtle, localized edit on the provided image based on a user's request and a mask image.

User Request: "${userPrompt}"

**CRITICAL INSTRUCTIONS:**
1.  **Use the Mask**: You are given two images: the original photo and a black and white mask.
2.  **Apply to White Area**: You MUST apply the user's requested edit ONLY to the areas of the photo that correspond to the WHITE parts of the mask image.
3.  **Do Not Touch Black Area**: The areas of the photo corresponding to the BLACK parts of the mask image must remain completely unchanged and identical to the original.
4.  **Subtlety is Key**: All enhancements must be extremely subtle and photorealistic. The goal is to enhance, not to transform. The person should still look like themselves. Avoid any plastic, airbrushed, or unnatural looks.
5.  **Seamless Blending**: The edit must be realistic and blend seamlessly with the surrounding, unedited area.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image, mask, and prompt to the model for facial enhancement...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, maskImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for facial enhancement.', response);

        return handleApiResponse(response, 'facial enhancement');
    } catch (err: any) {
        console.error('Error during facial enhancement:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    try {
        console.log(`Starting filter generation: ${filterPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request.
Filter Request: "${filterPrompt}"

**IMPORTANT**: Do not change the composition, content, or fundamental identity of people in the image. Only apply the requested artistic style.

Output: Return ONLY the final filtered image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image and filter prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for filter.', response);
        
        return handleApiResponse(response, 'filter');
    } catch (err: any) {
        console.error('Error during filter generation:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
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
    try {
        console.log(`Starting style transfer with ${referenceImages.length} reference images.`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const targetImagePart = await fileToPart(targetImage);
        const referenceImageParts = await Promise.all(referenceImages.map(file => fileToPart(file)));

        const prompt = `You are a master photo editor AI specializing in style transfer. Your task is to apply the artistic style from a set of reference images onto a target image.

**CRITICAL INSTRUCTIONS:**
1.  **Identify Images**: The VERY FIRST image provided is the TARGET image that you must edit. All SUBSEQUENT images are STYLE REFERENCE images.
2.  **Analyze Style**: Deeply analyze the style of the REFERENCE images. Pay attention to color palette, lighting, texture, brush strokes (if any), mood, and overall aesthetic.
3.  **Transfer Style, Preserve Content**: Apply the analyzed style to the TARGET image. You MUST PRESERVE the content, composition, and subjects of the target image. DO NOT change what is in the picture, only HOW it looks.
4.  **Seamless Integration**: The style transfer should be comprehensive and result in a natural, cohesive final image.

**Output**: Return ONLY the final, stylized image. Do not return any text.`;
        const textPart = { text: prompt };

        const allParts = [targetImagePart, ...referenceImageParts, textPart];

        console.log('Sending target and style reference images to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for style transfer.', response);
        
        return handleApiResponse(response, 'style transfer');
    } catch (err: any) {
        console.error('Error during style transfer:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
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
    try {
        console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.
- Do not fundamentally alter a person's identity or core characteristics. Standard enhancements like adjusting skin tone for a tan are acceptable.

Output: Return ONLY the final adjusted image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image and adjustment prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for adjustment.', response);
        
        return handleApiResponse(response, 'adjustment');
    } catch (err: any) {
        console.error('Error during global adjustment:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates a colorized image from a black and white image using generative AI.
 * @param originalImage The original black and white image file.
 * @param colorPrompt The text prompt describing the desired colors.
 * @returns A promise that resolves to the data URL of the colorized image.
 */
export const generateColorizedImage = async (
    originalImage: File,
    colorPrompt: string,
): Promise<string> => {
    try {
        console.log(`Starting colorization with prompt: ${colorPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are a professional photo colorization AI. You are an expert in historical accuracy and photorealism. Your task is to colorize the provided black and white image based on the user's color description.

Color Description: "${colorPrompt}"

**CRITICAL INSTRUCTIONS:**
1.  **Analyze Content**: First, analyze the content of the black and white image.
2.  **Apply Colors**: Use the user's description to apply colors realistically to the image. If the user provides specific instructions (e.g., 'a red dress', 'blue eyes'), you must follow them.
3.  **Natural Infilling**: For areas not mentioned in the prompt, infer and apply natural, period-appropriate, and realistic colors.
4.  **Preserve Details**: Do not change the composition, textures, or details of the original image. You are only adding a color layer. The underlying luminance values must be preserved.
5.  **Photorealism**: The final result must be a seamless, photorealistic color photograph. Avoid overly saturated or cartoonish colors unless specifically requested.

**Output**: Return ONLY the final colorized image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending B&W image and color prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for colorization.', response);
        
        return handleApiResponse(response, 'colorize');
    } catch (err: any) {
        console.error('Error during colorization:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates an image with fine-grained color adjustments (HSB) applied, optionally within a mask.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The string describing the HSB adjustments.
 * @param maskImage Optional mask file. If provided, adjustments are applied only to the white areas.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateColorAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
    maskImage?: File
): Promise<string> => {
    try {
        console.log(`Starting color adjustment: ${adjustmentPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        const originalImagePart = await fileToPart(originalImage);
        const parts = [originalImagePart];
        let prompt: string;

        if (maskImage) {
            const maskImagePart = await fileToPart(maskImage);
            parts.push(maskImagePart);
            prompt = `You are a professional photo editing AI. Your task is to apply HSB adjustments based on the user's request, but only within the area specified by a mask.

**Adjustment Request**: "${adjustmentPrompt}"

**CRITICAL Execution Guidelines:**
- **Use the Mask**: You are given two images: the original photo and a black and white mask.
- **Apply to White Area ONLY**: Apply the adjustments ONLY to the areas of the photo corresponding to the WHITE parts of the mask.
- **Leave Black Area Unchanged**: The areas corresponding to the BLACK parts of the mask must remain identical to the original photo.
- **Seamless Blending**: Ensure the transition between the edited and unedited areas is smooth and natural.
- **Maintain Content**: Do not change any content, objects, or composition. This is a color correction task ONLY.

**Output**: Return ONLY the final color-corrected image. Do not return any text.`;
        } else {
            prompt = `You are a professional photo editing AI. Your task is to apply the following Hue, Saturation, and Brightness (HSB) adjustments to the entire image.

**Adjustment Request**: "${adjustmentPrompt}"

**CRITICAL Execution Guidelines:**
- **Apply Globally**: The adjustments must be applied evenly across the entire image.
- **Maintain Content**: Do not change any content, objects, or composition. This is a color correction task ONLY.
- **Natural Results**: The final image must look photorealistic.

**Output**: Return ONLY the final color-corrected image. Do not return any text.`;
        }
        
        const textPart = { text: prompt };

        console.log('Sending image and color adjustment prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [...parts, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for color adjustment.', response);
        
        return handleApiResponse(response, 'color adjustment');
    } catch (err: any) {
        console.error('Error during color adjustment:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
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
    try {
        console.log(`Starting background replacement: ${backgroundPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo editor AI. Your task is to precisely identify the main subject(s) in the provided image and replace the background completely.
Background Request: "${backgroundPrompt}"

Editing Guidelines:
- The foreground subject(s) must remain entirely unchanged and perfectly preserved.
- The new background should be photorealistic and blend naturally with the subject's lighting and edges.
- If the request is for a solid color, create a clean, uniform background of that color.

Output: Return ONLY the final edited image with the new background. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image and background prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for background replacement.', response);
        
        return handleApiResponse(response, 'background');
    } catch (err: any) {
        console.error('Error during background replacement:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
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
    try {
        console.log(`Starting background replacement with a reference image.`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const backgroundImagePart = await fileToPart(backgroundImage);
        const prompt = `You are an expert photo editor AI. Your task is to precisely identify the main subject(s) in the first image and replace its background with the second image.

Editing Guidelines:
- The first image contains the foreground subject(s) to be preserved.
- The second image is the new background. Use the entire second image as the replacement background.
- The foreground subject(s) from the first image must remain entirely unchanged and perfectly preserved.
- The new background should blend naturally with the subject's lighting and edges.

Output: Return ONLY the final edited image with the new background. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending images and background replacement prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, backgroundImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for image background replacement.', response);
        
        return handleApiResponse(response, 'background');
    } catch (err: any) {
        console.error('Error during background replacement from image:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};


/**
 * Changes clothing on a person in an image using a reference clothing image.
 * @param originalImage The original image with the person.
 * @param clothingImage The image of the clothing item.
 * @param userPrompt The text prompt describing the change.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateClothingChange = async (
    originalImage: File,
    clothingImage: File,
    userPrompt: string,
): Promise<string> => {
    try {
        console.log(`Starting clothing change with prompt: ${userPrompt}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const clothingImagePart = await fileToPart(clothingImage);

        const prompt = `You are a virtual try-on AI expert. Your task is to take the clothing item from the second image (the reference clothing) and realistically place it on the person in the first image (the main subject). The user's request provides additional context.

User Request: "${userPrompt}"

Editing Guidelines:
- The person in the first image is the main subject. The second image contains the reference garment.
- Realistically fit the clothing from the second image onto the person. You must adapt the clothing to the person's pose, body shape, and the lighting of the original scene.
- Preserve the person's identity. Do not change their face, hair, skin, or any body parts not covered by the new clothing.
- The background from the original image must remain completely unchanged.
- The final result must be photorealistic and seamlessly blended.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending images and clothing prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, clothingImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for clothing change.', response);
        
        return handleApiResponse(response, 'clothing');
    } catch (err: any) {
        console.error('Error during clothing change:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Swaps the face in an image with a face from a reference image.
 * @param originalImage The original image with the subject.
 * @param faceReferenceImages The images containing the face to swap in.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateFaceSwap = async (
    originalImage: File,
    faceReferenceImages: File[],
): Promise<string> => {
    try {
        console.log(`Starting face swap with ${faceReferenceImages.length} reference images.`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const faceReferenceParts = await Promise.all(faceReferenceImages.map(file => fileToPart(file)));

        const prompt = `You are an expert AI photo editor specializing in hyper-realistic, 3D-aware face swapping. Your task is to replace the face of the primary subject in the first image with a new face synthesized from the multiple reference images provided.

CRITICAL INSTRUCTIONS:
1.  **Analyze Pose**: First, analyze the pose and angle of the face in the first (target) image.
2.  **Synthesize from References**: Use the provided reference face images to construct the new face. The references show the face from different angles. You MUST select the most appropriate reference image(s) or blend features from them to create a new face that is dimensionally correct and accurately matches the target's head position and angle.
3.  **Preserve Identity**: Transfer ONLY the facial features and identity from the source images.
4.  **Preserve Target Attributes**: You MUST preserve the original pose, expression, hair, lighting, skin tone, and background of the target image. The new face must be seamlessly integrated with the target's skin tone and lighting.
5.  **Photorealism**: The final result must be a seamless, photorealistic composite. The swap should be undetectable.

**Important**: This tool is for creative and professional purposes. Do not create deceptive or harmful content. Do not alter the fundamental identity of the person in a way that is not represented in the source face.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };
        
        const allParts = [originalImagePart, ...faceReferenceParts, textPart];

        console.log('Sending images and face swap prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for face swap.', response);
        
        return handleApiResponse(response, 'face swap');
    } catch (err: any) {
        console.error('Error during face swap:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};


/**
 * Enhances the quality of an image by upscaling and refining details.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generateEnhancedImage = async (
    originalImage: File,
): Promise<string> => {
    try {
        console.log(`Starting image enhancement.`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo restoration and enhancement AI. Your task is to upscale and improve the quality of the provided image.

Editing Guidelines:
- Increase the image's resolution and sharpness.
- Remove any noise, grain, or compression artifacts.
- Enhance details and textures to make the image look clearer and more professional.
- The final result must be a natural-looking, higher-fidelity version of the original. Do not add or change the content of the image.

Output: Return ONLY the final enhanced image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image and enhancement prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for enhancement.', response);
        
        return handleApiResponse(response, 'enhancement');
    } catch (err: any) {
        console.error('Error during image enhancement:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Enhances a specific area of an image using generative AI.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired enhancement.
 * @param hotspot The {x, y} coordinates on the image to focus the enhancement.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generateAreaEnhancement = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    try {
        console.log(`Starting area enhancement at: ${hotspot} with prompt: "${userPrompt}"`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized enhancement on the provided image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

Editing Guidelines:
- The enhancement must be realistic and blend seamlessly with the surrounding area. Focus on improving quality, such as sharpness, clarity, and detail.
- The rest of the image (outside the immediate edit area) must remain identical to the original.
- Do not add, remove, or change the content of the image; only enhance its quality in the specified region.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };

        console.log('Sending image and area enhancement prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for area enhancement.', response);

        return handleApiResponse(response, 'area enhancement');
    } catch (err: any) {
        console.error('Error during area enhancement:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates a new image from a different camera angle.
 * @param originalImage The original image file.
 * @param cameraMovement The text prompt describing the camera movement.
 * @returns A promise that resolves to the data URL of the new image.
 */
export const generateNewAngleImage = async (
    originalImage: File,
    cameraMovement: string,
): Promise<string> => {
    try {
        console.log(`Starting new angle generation with movement: ${cameraMovement}`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are a master photo editor. Your task is to edit the provided photo to create the illusion that it was taken from a slightly different camera angle, as described below.

Camera Movement: "${cameraMovement}"

**CRITICAL INSTRUCTIONS**:
1.  **Do Not Change The Subject**: The main person or object in the photo must remain IDENTICAL. Do not change their pose, expression, clothing, or identity. They are static.
2.  **Warp Perspective**: To achieve the camera movement effect, you must subtly warp and edit the background and surrounding environment to create a realistic shift in perspective.
3.  **Maintain Realism**: The final image MUST look like a real photograph. It must perfectly match the original's lighting, quality, and style.
4.  **Inpaint Missing Areas**: As the perspective shifts, you will need to realistically generate (inpaint) any new parts of the background that become visible.

**Output**: Return ONLY the final edited photograph. Do not provide any text.`;
        const textPart = { text: prompt };

        console.log('Sending image and camera movement prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for camera angle change.', response);
        
        return handleApiResponse(response, 'camera angle');
    } catch (err: any) {
        console.error('Error during camera angle change:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Adds a person from a reference image into the main image.
 * @param originalImage The main image file.
 * @param personReferenceImage The image file of the person to add.
 * @param userPrompt A prompt describing placement.
 * @returns A promise that resolves to the data URL of the composited image.
 */
export const generateAddedPerson = async (
    originalImage: File,
    personReferenceImage: File,
    userPrompt: string
): Promise<string> => {
    try {
        console.log(`Starting to add person with prompt: "${userPrompt}"`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const personReferencePart = await fileToPart(personReferenceImage);

        const prompt = `You are an expert photo compositing AI. Your task is a two-step process:
1.  **Isolate Person**: First, look at the second image (the reference). Perfectly isolate the primary person in this image, removing their background completely.
2.  **Composite into Scene**: Take the isolated person and realistically place them into the first image (the main scene).

**User Guidance for Placement**: "${userPrompt}"

**CRITICAL Compositing Guidelines**:
-   **Seamless Integration**: The added person must blend perfectly into the main scene.
-   **Lighting & Shadows**: Analyze the lighting of the main scene and apply it to the added person. They must cast a realistic shadow on the ground/surfaces that matches the direction and softness of existing shadows.
-   **Scale & Perspective**: The person's size and perspective must be plausible for the location they are placed in.
-   **Color Grading**: Adjust the color and tone of the added person to match the overall color grade of the main scene.
-   **Do Not Alter Scene**: The original scene (first image) should remain unchanged, except for the addition of the new person and their shadow.

**Output**: Return ONLY the final composited image. Do not return text.`;

        const textPart = { text: prompt };

        console.log('Sending images and add person prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, personReferencePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for adding person.', response);
        
        return handleApiResponse(response, 'add person');
    } catch (err: any) {
        console.error('Error adding person:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Adds an object to an image from a text prompt at a specified location.
 * @param originalImage The main image file.
 * @param objectPrompt The text prompt describing the object to generate.
 * @param hotspot The {x, y} coordinates on the image to place the object.
 * @returns A promise that resolves to the data URL of the composited image.
 */
export const generateAddedObjectFromText = async (
    originalImage: File,
    objectPrompt: string,
    hotspot: Hotspot
): Promise<string> => {
    try {
        console.log(`Starting to add object from text: "${objectPrompt}" at:`, hotspot);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo compositing AI. Your task is to generate a new object and realistically place it into the provided scene.

**Object to Generate**: "${objectPrompt}"
**Placement Location**: The object should be centered around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

**CRITICAL Compositing Guidelines**:
-   **Generate and Composite**: First, generate the object described in the prompt. Then, seamlessly integrate it into the main scene at the specified location.
-   **Lighting & Shadows**: Analyze the lighting of the main scene and apply it to the generated object. It must cast a realistic shadow on the ground/surfaces that matches the direction and softness of existing shadows.
-   **Scale & Perspective**: The object's size and perspective must be plausible for where it's placed.
-   **Color Grading**: Adjust the color and tone of the generated object to match the overall color grade of the main scene.
-   **Do Not Alter Scene**: The original scene should remain unchanged, except for the addition of the new object and its shadow.

**Output**: Return ONLY the final composited image. Do not return text.`;

        const textPart = { text: prompt };

        console.log('Sending image and add object prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for adding object from text.', response);
        
        return handleApiResponse(response, 'add object');
    } catch (err: any) {
        console.error('Error adding object from text:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Adds an object from a reference image into the main image at a specified location.
 * @param originalImage The main image file.
 * @param objectReferenceImage The image file of the object to add.
 * @param hotspot The {x, y} coordinates on the image to place the object.
 * @returns A promise that resolves to the data URL of the composited image.
 */
export const generateAddedObjectFromUpload = async (
    originalImage: File,
    objectReferenceImage: File,
    hotspot: Hotspot
): Promise<string> => {
    try {
        console.log(`Starting to add object from upload at:`, hotspot);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const objectReferencePart = await fileToPart(objectReferenceImage);

        const prompt = `You are an expert photo compositing AI. Your task is a two-step process:
1.  **Isolate Object**: Look at the second image (the reference). Perfectly isolate the primary object in this image, removing its background completely.
2.  **Composite into Scene**: Take the isolated object and realistically place it into the first image (the main scene).

**Placement Location**: The object should be centered around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

**CRITICAL Compositing Guidelines**:
-   **Seamless Integration**: The added object must blend perfectly into the main scene.
-   **Lighting & Shadows**: Analyze the lighting of the main scene and apply it to the added object. It must cast a realistic shadow on the ground/surfaces that matches the direction and softness of existing shadows.
-   **Scale & Perspective**: The object's size and perspective must be plausible for the location it is placed in.
-   **Color Grading**: Adjust the color and tone of the added object to match the overall color grade of the main scene.
-   **Do Not Alter Scene**: The original scene should remain unchanged, except for the addition of the new object and its shadow.

**Output**: Return ONLY the final composited image. Do not return text.`;

        const textPart = { text: prompt };

        console.log('Sending images and add object prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, objectReferencePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for adding object from upload.', response);
        
        return handleApiResponse(response, 'add object');
    } catch (err: any) {
        console.error('Error adding object from upload:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Expands an image by generating content in a new, transparent area.
 * @param originalImage The original image file.
 * @param direction The direction to expand ('up', 'down', 'left', 'right').
 * @param expandPercentage The percentage of the original dimension to add.
 * @returns A promise that resolves to the data URL of the expanded image.
 */
export const generateExpandedImage = async (
    originalImage: File,
    direction: 'up' | 'down' | 'left' | 'right',
    expandPercentage: number
): Promise<string> => {
    try {
        console.log(`Starting image expansion to the ${direction} by ${expandPercentage}%`);

        const image = new Image();
        const imageUrl = URL.createObjectURL(originalImage);
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = reject;
            image.src = imageUrl;
        });
        URL.revokeObjectURL(imageUrl);

        const { naturalWidth: w, naturalHeight: h } = image;
        const expandRatio = expandPercentage / 100;
        
        let newWidth = w, newHeight = h;
        let offsetX = 0, offsetY = 0;

        switch(direction) {
            case 'up':
                newHeight = h * (1 + expandRatio);
                offsetY = h * expandRatio;
                break;
            case 'down':
                newHeight = h * (1 + expandRatio);
                break;
            case 'left':
                newWidth = w * (1 + expandRatio);
                offsetX = w * expandRatio;
                break;
            case 'right':
                newWidth = w * (1 + expandRatio);
                break;
        }

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not create canvas context");

        ctx.drawImage(image, offsetX, offsetY);
        
        const compositeImageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!compositeImageBlob) throw new Error("Could not create blob from canvas");

        const compositeImageFile = new File([compositeImageBlob], "composite_for_expansion.png", { type: 'image/png' });
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const imagePart = await fileToPart(compositeImageFile);

        const prompt = `You are an expert photo editor AI specializing in outpainting and panorama generation. The user has provided an image that has been placed on a larger, transparent canvas.

**Your task is to inpaint ONLY the transparent area.**

**CRITICAL INSTRUCTIONS:**
1.  **Seamless Extension**: Fill the transparent area by seamlessly extending the existing image. The result must look like a single, continuous photograph.
2.  **Match Style**: Perfectly match the style, lighting, color grading, and content of the original image.
3.  **DO NOT CHANGE ORIGINAL**: The non-transparent part of the image is the original. You MUST NOT alter it in any way.
4.  **Photorealism**: The final output must be a high-resolution, photorealistic image.

**Output**: Return ONLY the final, complete image with the transparent area filled. Do not return any text.`;
        const textPart = { text: prompt };

        console.log('Sending composite image and expansion prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for image expansion.', response);
        
        return handleApiResponse(response, 'expansion');
    } catch (err: any) {
        console.error('Error during image expansion:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Expands an image on all sides ("uncrop" or "outpaint").
 * @param originalImage The original image file.
 * @param expandPercentage The percentage of the original dimension to add to each side.
 * @returns A promise that resolves to the data URL of the expanded image.
 */
export const generateUncroppedImage = async (
    originalImage: File,
    expandPercentage: number
): Promise<string> => {
    try {
        console.log(`Starting image uncropping by ${expandPercentage}% on all sides`);

        const image = new Image();
        const imageUrl = URL.createObjectURL(originalImage);
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = reject;
            image.src = imageUrl;
        });
        URL.revokeObjectURL(imageUrl);

        const { naturalWidth: w, naturalHeight: h } = image;
        const expandRatio = expandPercentage / 100;
        
        const newWidth = w * (1 + 2 * expandRatio);
        const newHeight = h * (1 + 2 * expandRatio);
        const offsetX = w * expandRatio;
        const offsetY = h * expandRatio;

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not create canvas context");

        ctx.drawImage(image, offsetX, offsetY);
        
        const compositeImageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!compositeImageBlob) throw new Error("Could not create blob from canvas");

        const compositeImageFile = new File([compositeImageBlob], "composite_for_uncrop.png", { type: 'image/png' });
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const imagePart = await fileToPart(compositeImageFile);

        const prompt = `You are an expert photo editor AI specializing in outpainting. The user has provided an image that has been placed in the center of a larger, transparent canvas.

**Your task is to inpaint ALL the surrounding transparent areas.**

**CRITICAL INSTRUCTIONS:**
1.  **Seamless Extension**: Fill all transparent areas by seamlessly extending the existing image. The result must look like a single, continuous photograph.
2.  **Match Style**: Perfectly match the style, lighting, color grading, and content of the original image.
3.  **DO NOT CHANGE ORIGINAL**: The non-transparent part of the image is the original. You MUST NOT alter it in any way.
4.  **Photorealism**: The final output must be a high-resolution, photorealistic image.

**Output**: Return ONLY the final, complete image with the transparent areas filled. Do not return any text.`;
        const textPart = { text: prompt };

        console.log('Sending composite image and uncrop prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for image uncropping.', response);
        
        return handleApiResponse(response, 'uncrop');
    } catch (err: any) {
        console.error('Error during image uncropping:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Combines multiple items from reference images onto a main image using a text prompt.
 * @param originalImage The main image file with the subject.
 * @param itemFiles An array of image files containing the items to add (clothing, accessories, etc.).
 * @param userPrompt A text prompt describing how to combine the items.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateMixedImage = async (
    originalImage: File,
    itemFiles: File[],
    userPrompt: string,
): Promise<string> => {
    try {
        console.log(`Starting mix & match with ${itemFiles.length} items. Prompt: "${userPrompt}"`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const itemParts = await Promise.all(itemFiles.map(file => fileToPart(file)));

        const prompt = `You are a virtual stylist and expert photo editor AI. Your task is to take multiple clothing and accessory items from a set of reference images and realistically place them on the person in the first image (the main subject). The user's text prompt will guide the combination.

User Request: "${userPrompt}"

**CRITICAL INSTRUCTIONS:**
1.  **Identify Images**: The VERY FIRST image provided is the main subject/model. All SUBSEQUENT images are reference items (clothing, accessories, etc.).
2.  **Isolate Items**: For each reference image, isolate the clothing/accessory item, removing its original background.
3.  **Combine & Fit**: Realistically fit the specified items onto the person from the first image according to the user's request. You MUST adapt the items to the person's pose, body shape, and the lighting of the original scene.
4.  **Preserve Identity**: Preserve the person's identity. Do not change their face, hair, skin, or any body parts not covered by the new items.
5.  **Preserve Background**: The background from the original image must remain completely unchanged.
6.  **Photorealism**: The final result must be a photorealistic and seamlessly blended composite.

Output: Return ONLY the final edited image. Do not return text.`;
        const textPart = { text: prompt };
        
        const allParts = [originalImagePart, ...itemParts, textPart];

        console.log('Sending images and mix & match prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: allParts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for mix & match.', response);
        
        return handleApiResponse(response, 'mix & match');
    } catch (err: any) {
        console.error('Error during mix & match:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates an image with a transparent background by isolating the main subject.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the image with a transparent background.
 */
export const generateTransparentBackground = async (
    originalImage: File,
): Promise<string> => {
    try {
        console.log(`Starting transparent background generation.`);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const originalImagePart = await fileToPart(originalImage);
        const prompt = `You are an expert photo editor AI. Your task is to precisely identify the main foreground subject(s) in the provided image and make the background transparent.

CRITICAL INSTRUCTIONS:
1.  **Isolate Subject**: Perfectly segment the main subject(s) from the background. Pay close attention to fine details like hair, fur, and semi-transparent objects.
2.  **Make Background Transparent**: Remove the background completely, making it transparent.
3.  **Preserve Subject**: The foreground subject(s) must remain entirely unchanged and perfectly preserved. Do not alter their colors, lighting, or details.
4.  **Output Format**: The output MUST be a PNG image with a transparent alpha channel.

Output: Return ONLY the final edited image with the transparent background. Do not return any text.`;
        const textPart = { text: prompt };

        console.log('Sending image and transparent background prompt to the model...');
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [originalImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        console.log('Received response from model for transparent background.', response);
        
        return handleApiResponse(response, 'transparent background');
    } catch (err: any) {
        console.error('Error during transparent background generation:', err);
        if (isCustomError(err.message)) throw err;
        throw new Error(GENERIC_API_ERROR_MESSAGE);
    }
};

/**
 * Generates smart suggestions for a batch editing recipe.
 * @param recipeSteps An array of strings describing the recipe steps.
 * @returns A promise that resolves to an array of suggestion strings.
 */
export const generateBatchSuggestions = async (
    recipeSteps: string[],
): Promise<string[]> => {
    if (recipeSteps.length === 0) {
        return [];
    }
    
    try {
        console.log(`Generating suggestions for recipe:`, recipeSteps);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        const recipeString = recipeSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');

        const prompt = `You are an expert AI photo editing assistant. A user is creating a batch processing recipe with the following ordered steps:
---
${recipeString}
---
Based on this specific order, provide 2-3 concise, actionable suggestions to improve the editing workflow or the final quality of the images. Frame the suggestions as helpful tips. Focus on the order of operations (e.g., 'Enhance is often best applied last,' or 'Applying color adjustments after filters can produce more predictable results.'). Do not suggest adding new steps not already present.

Return the suggestions as a JSON array of strings.
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                description: 'A single, actionable suggestion for the user.'
                            }
                        }
                    }
                }
            },
        });

        const jsonStr = response.text.trim();
        if (!jsonStr) {
            console.warn("Received empty text response for suggestions.");
            return [];
        }

        const result = JSON.parse(jsonStr);
        if (result && Array.isArray(result.suggestions)) {
            console.log("Received suggestions:", result.suggestions);
            return result.suggestions;
        }

        console.warn("Could not parse suggestions from response:", result);
        return [];

    } catch (err) {
        console.error("Error generating batch suggestions:", err);
        // Don't throw an error to the user, just return empty array
        return [];
    }
};