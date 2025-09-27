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