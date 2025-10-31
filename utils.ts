/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Converts a data URL string to a File object.
 * @param dataurl The data URL to convert.
 * @param filename The desired filename for the new File object.
 * @returns A File object.
 */
export const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid mime type");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

/**
 * Converts a File object to a data URL string.
 * @param file The file to convert.
 * @returns A promise that resolves to the data URL.
 */
export const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Creates a thumbnail collage from a list of image URLs.
 * @param imageUrls An array of data URLs for the source images.
 * @returns A promise that resolves to a data URL of the generated thumbnail.
 */
export const createStyleThumbnail = (imageUrls: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvasSize = 200;
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        const imagesToLoad = imageUrls.slice(0, 4); // Use max 4 images for thumbnail
        let loadedCount = 0;

        const images = imagesToLoad.map(url => {
            const img = new Image();
            img.src = url;
            return img;
        });

        const onImageLoad = () => {
            loadedCount++;
            if (loadedCount === images.length) {
                drawCollage();
            }
        };

        images.forEach(img => {
            if (img.complete) {
                onImageLoad();
            } else {
                img.onload = onImageLoad;
                img.onerror = () => { // Handle potential loading errors
                    loadedCount++;
                    if(loadedCount === images.length) drawCollage();
                };
            }
        });

        const drawCollage = () => {
            const numImages = images.filter(img => img.height > 0).length; // Only count successfully loaded images
            if (numImages === 0) {
                resolve(canvas.toDataURL()); // Return blank canvas if no images loaded
                return;
            }

            const gap = 4; // Gap between images
            
            if (numImages === 1) {
                drawImageCover(ctx, images[0], 0, 0, canvasSize, canvasSize);
            } else if (numImages === 2) {
                const w = (canvasSize - gap) / 2;
                drawImageCover(ctx, images[0], 0, 0, w, canvasSize);
                drawImageCover(ctx, images[1], w + gap, 0, w, canvasSize);
            } else if (numImages === 3) {
                const w = (canvasSize - gap) / 2;
                const h = (canvasSize - gap) / 2;
                drawImageCover(ctx, images[0], 0, 0, w, canvasSize);
                drawImageCover(ctx, images[1], w + gap, 0, w, h);
                drawImageCover(ctx, images[2], w + gap, h + gap, w, h);
            } else { // 4 or more
                const w = (canvasSize - gap) / 2;
                const h = (canvasSize - gap) / 2;
                drawImageCover(ctx, images[0], 0, 0, w, h);
                drawImageCover(ctx, images[1], w + gap, 0, w, h);
                drawImageCover(ctx, images[2], 0, h + gap, w, h);
                drawImageCover(ctx, images[3], w + gap, h + gap, w, h);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
};

// Helper to draw an image with object-fit: cover behavior
const drawImageCover = (
    ctx: CanvasRenderingContext2D, 
    img: HTMLImageElement, 
    x: number, 
    y: number, 
    w: number, 
    h: number
) => {
    const imgRatio = img.width / img.height;
    const containerRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > containerRatio) { // Image is wider than container
        sw = img.height * containerRatio;
        sh = img.height;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else { // Image is taller or same ratio
        sw = img.width;
        sh = img.width / containerRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

/**
 * Applies a crop to an image file and returns the result as a data URL.
 * @param sourceFile The source image file.
 * @param crop The crop parameters (x, y, width, height).
 * @returns A promise that resolves to the data URL of the cropped image.
 */
export const applyCrop = (
    sourceFile: File, 
    crop: { x: number; y: number; width: number; height: number; }
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) return reject('Could not read file');
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = crop.width;
                canvas.height = crop.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Could not get canvas context');
                
                ctx.drawImage(
                    image,
                    crop.x, // source x
                    crop.y, // source y
                    crop.width, // source width
                    crop.height, // source height
                    0, // dest x
                    0, // dest y
                    crop.width, // dest width
                    crop.height // dest height
                );
                resolve(canvas.toDataURL());
            };
            image.onerror = reject;
            image.src = event.target.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(sourceFile);
    });
};

/**
 * Downscales an image file if its dimensions exceed a maximum size.
 * @param file The source image file.
 * @param maxSize The maximum width or height.
 * @returns A promise that resolves to the downscaled file, or the original file if no scaling was needed.
 */
export const downscaleImage = (file: File, maxSize: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            if (!e.target?.result) return reject('Could not read file for downscaling');
            image.src = e.target.result as string;
        };
        reader.onerror = reject;

        image.onload = () => {
            let { width, height } = image;

            // Check if downscaling is necessary
            if (width <= maxSize && height <= maxSize) {
                return resolve(file);
            }

            if (width > height) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
            } else {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context for downscaling');

            ctx.drawImage(image, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) return reject('Canvas to Blob conversion failed');
                // Use a modified filename to indicate it's a preview version
                const newFile = new File([blob], `preview_${file.name}`, {
                    type: blob.type,
                    lastModified: Date.now(),
                });
                resolve(newFile);
            }, file.type, 0.9); // Use original file type, with 0.9 quality for formats that support it
        };
        image.onerror = reject;

        reader.readAsDataURL(file);
    });
};

/**
 * Creates an expanded canvas with the original image offset, and a corresponding mask.
 * @param sourceFile The original image file.
 * @param direction The direction to expand ('up', 'down', 'left', 'right', or 'all').
 * @param percentage The percentage to expand by.
 * @returns A promise resolving to an object with 'image' and 'mask' data URLs.
 */
export const createExpandedCanvas = (
    sourceFile: File,
    direction: 'up' | 'down' | 'left' | 'right' | 'all',
    percentage: number
): Promise<{ image: string; mask: string }> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = e => {
            if (!e.target?.result) return reject('Could not read file for canvas creation');
            image.src = e.target.result as string;
        };
        reader.onerror = reject;

        image.onload = () => {
            const { width: originalWidth, height: originalHeight } = image;
            const expandX = Math.round(originalWidth * (percentage / 100));
            const expandY = Math.round(originalHeight * (percentage / 100));

            let newWidth = originalWidth;
            let newHeight = originalHeight;
            let drawX = 0;
            let drawY = 0;

            if (direction === 'up') {
                newHeight += expandY;
                drawY = expandY;
            } else if (direction === 'down') {
                newHeight += expandY;
            } else if (direction === 'left') {
                newWidth += expandX;
                drawX = expandX;
            } else if (direction === 'right') {
                newWidth += expandX;
            } else if (direction === 'all') { // for uncrop
                newWidth += expandX * 2;
                newHeight += expandY * 2;
                drawX = expandX;
                drawY = expandY;
            }

            // Create main canvas with image
            const imageCanvas = document.createElement('canvas');
            imageCanvas.width = newWidth;
            imageCanvas.height = newHeight;
            const imageCtx = imageCanvas.getContext('2d');
            if (!imageCtx) return reject('Could not get image canvas context');
            imageCtx.fillStyle = 'black';
            imageCtx.fillRect(0, 0, newWidth, newHeight);
            imageCtx.drawImage(image, drawX, drawY, originalWidth, originalHeight);

            // Create mask canvas
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = newWidth;
            maskCanvas.height = newHeight;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) return reject('Could not get mask canvas context');
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, newWidth, newHeight);
            maskCtx.fillStyle = 'white';
            
            if (direction === 'up') {
                maskCtx.fillRect(0, 0, newWidth, expandY);
            } else if (direction === 'down') {
                maskCtx.fillRect(0, originalHeight, newWidth, expandY);
            } else if (direction === 'left') {
                maskCtx.fillRect(0, 0, expandX, newHeight);
            } else if (direction === 'right') {
                maskCtx.fillRect(originalWidth, 0, expandX, newHeight);
            } else if (direction === 'all') {
                maskCtx.fillRect(0, 0, newWidth, drawY); // Top
                maskCtx.fillRect(0, drawY + originalHeight, newWidth, drawY); // Bottom
                maskCtx.fillRect(0, drawY, drawX, originalHeight); // Left
                maskCtx.fillRect(drawX + originalWidth, drawY, drawX, originalHeight); // Right
            }

            resolve({
                image: imageCanvas.toDataURL(),
                mask: maskCanvas.toDataURL()
            });
        };
        
        reader.readAsDataURL(sourceFile);
    });
};

/**
 * Decodes a Base64 string into a Uint8Array.
 * This is a required helper function for the Gemini Live API.
 * @param base64 The Base64 string to decode.
 * @returns The decoded Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * This is a required helper function for the Gemini Live API.
 * @param data The raw audio data as a Uint8Array.
 * @param ctx The AudioContext to use for creating the buffer.
 * @param sampleRate The sample rate of the audio.
 * @param numChannels The number of audio channels.
 * @returns A promise that resolves to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Encodes a Uint8Array into a Base64 string.
 * This is a required helper function for the Gemini Live API.
 * @param bytes The Uint8Array to encode.
 * @returns The Base64 encoded string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates a Gemini API Blob object from raw audio data.
 * This is a required helper function for the Gemini Live API.
 * @param data The Float32Array of PCM audio data.
 * @returns A Blob object for the API.
 */
export const createGeminiBlob = (data: Float32Array): { data: string; mimeType: string; } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};
