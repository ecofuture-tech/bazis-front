// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// An image larger than the limit of the uploads reduced in the browser to fit it (a photo of a
// phone), drawn on a canvas; a file within the limit is sent as it is (the original of a
// document is kept).

/** The quality of a JPEG or a WebP drawn again. */
const QUALITY = 0.85;
/** Each try draws the sides at this part of those of the image, after one at its own size. */
const STEP = 0.8;
const TRIES = 4;
/** The long side of the image drawn is never shorter (nor longer than that of the image). */
const MIN_SIDE = 1024;

/** The types that keep their type drawn again; another image is drawn as a JPEG. */
const KEPT: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Whether a file larger than the limit may be reduced to fit it: an image that a canvas draws,
 * not an animation (a GIF) nor a drawing (an SVG).
 */
export function reducible(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml';
}

function drawn(bitmap: ImageBitmap, scale: number, type: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, QUALITY);
  });
}

/**
 * The file to upload under the limit `maxSize` (in bytes; null: none): the file itself within
 * it; an image over it (`reducible`) drawn again, turned as its EXIF says, at its size, then
 * smaller by `STEP` (at most `TRIES` tries, its long side never under `MIN_SIDE` px), until it
 * fits: a PNG stays a PNG, a WebP a WebP, another image is a JPEG, its name kept (with `.jpg`
 * for a JPEG of another type). Null when it does not fit: not an image, an image that the
 * browser does not decode (HEIC), or still too large.
 */
export async function fitImage(file: File, maxSize: number | null): Promise<File | null> {
  if (maxSize === null || file.size <= maxSize) return file;
  if (!reducible(file)) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  try {
    const type = KEPT.includes(file.type) ? file.type : 'image/jpeg';
    const name = type === file.type ? file.name : `${file.name.replace(/\.[^.]*$/, '')}.jpg`;
    const least = Math.min(1, MIN_SIDE / Math.max(bitmap.width, bitmap.height));
    let scale = 1;
    for (let tried = 0; tried < TRIES; tried += 1) {
      const blob = await drawn(bitmap, scale, type);
      if (blob !== null && blob.size <= maxSize) return new File([blob], name, { type, lastModified: file.lastModified });
      if (scale === least) break;
      scale = Math.max(least, scale * STEP);
    }
    return null;
  } finally {
    bitmap.close();
  }
}
