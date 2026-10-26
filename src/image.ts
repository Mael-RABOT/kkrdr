/** Side of the stored square picture: sharp up to a 64 px avatar on a 3x screen. */
const SIDE = 192;
/** Must stay under the limit in firestore.rules (avatars). */
export const MAX_BYTES = 60_000;

/** A square area of the source image, in source pixels. */
export interface Crop {
  x: number;
  y: number;
  side: number;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Decodes an image file (EXIF orientation applied). */
export function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Renders the crop at the stored size and compresses it (WebP, or JPEG where WebP is unsupported). */
export async function encodeCrop(image: ImageBitmap, crop: Crop): Promise<{ bytes: Uint8Array; type: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x, crop.y, crop.side, crop.side, 0, 0, SIDE, SIDE);

  for (const quality of [0.85, 0.7, 0.5]) {
    let blob = await toBlob(canvas, 'image/webp', quality);
    // Browsers without WebP encoding fall back to PNG; use JPEG instead.
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_BYTES) return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
  }
  throw new Error('image too large');
}

/** Longest side tried for a post photo, largest first, until it fits. */
const PHOTO_SIDES = [1080, 900, 720];
/** Must stay under the limit in firestore.rules (pictures). */
export const PHOTO_MAX_BYTES = 250_000;

/** Shrinks a photo for a post, whole (no crop), and compresses it like encodeCrop. */
export async function encodePhoto(file: File): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string }> {
  const image = await loadImage(file);
  try {
    for (const side of PHOTO_SIDES) {
      const scale = Math.min(1, side / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        let blob = await toBlob(canvas, 'image/webp', quality);
        if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
        if (blob && blob.size <= PHOTO_MAX_BYTES) return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
      }
    }
  } finally {
    image.close();
  }
  throw new Error('image too large');
}
