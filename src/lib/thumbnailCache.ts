/**
 * Tiny thumbnails for team photos in long lists. Drawing a full-size photo
 * (often 4000px) into a 24px box costs a lot each time the row repaints, which
 * is what made drag-to-reorder stall at the start. Each photo is decoded once,
 * off the main path, scaled to a small square, and reused for the session.
 */

const SIZE = 96; // px; enough for a crisp 24–48px box on a 3x screen
const cache = new Map<string, Promise<string>>();
const resolved = new Map<string, string>();

/** imgur (used by TBA media) serves a 160px version: abc.jpg -> abct.jpg */
export function smallerSourceUrl(url: string): string {
  const m = url.match(/^(https?:\/\/i\.imgur\.com\/[A-Za-z0-9]+)(\.(?:jpe?g|png|gif|webp))(\?.*)?$/i);
  return m ? `${m[1]}t${m[2]}` : url;
}

async function makeThumb(url: string): Promise<string> {
  const src = smallerSourceUrl(url);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) return src;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.imageSmoothingQuality = "high";
    // Center-crop to a square, like object-cover
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return blob ? URL.createObjectURL(blob) : src;
  } catch {
    // CORS-blocked or undecodable: show the (possibly smaller) original
    return src;
  }
}

/** Already-made thumbnail, if any (lets rows render it on the first paint). */
export function cachedThumb(url: string): string | undefined {
  return resolved.get(url);
}

export function getThumb(url: string): Promise<string> {
  let p = cache.get(url);
  if (!p) {
    p = makeThumb(url).then((t) => {
      resolved.set(url, t);
      return t;
    });
    cache.set(url, p);
  }
  return p;
}
