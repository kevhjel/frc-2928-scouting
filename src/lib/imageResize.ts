/**
 * Downscale a photo on the device before uploading. Phone camera shots are
 * often 4000px / several MB; nothing in the app shows them that large.
 * Returns the original file if the browser can't decode it.
 */
export async function resizeImage(
  file: Blob,
  maxDim: number,
  quality = 0.85,
): Promise<Blob> {
  try {
    // "from-image" applies the EXIF rotation so portrait shots stay upright
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_000_000) {
      bitmap.close();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
