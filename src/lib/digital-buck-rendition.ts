import "server-only";

import sharp from "sharp";

export type BookImageSize = "gallery" | "thumbnail" | "viewer";

export async function readerRendition(image: ArrayBuffer, size: BookImageSize) {
  const source = Buffer.from(image);
  if (size === "viewer") {
    const { width, height } = await sharp(source).metadata();
    if (width && height && width <= 1440 && height <= 1440) return source;
  }
  const dimensions = size === "viewer" ? { width: 1440, height: 1440, quality: 78 }
    : size === "gallery" ? { width: 720, height: 480, quality: 70 }
    : { width: 240, height: 180, quality: 60 };
  return sharp(source)
    .resize({ width: dimensions.width, height: dimensions.height, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: dimensions.quality, mozjpeg: true })
    .toBuffer();
}
