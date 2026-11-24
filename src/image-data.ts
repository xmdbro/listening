const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MISSING_IMAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

interface CachedImage {
  dataUrl: string;
  expiresAt: number;
}

const imageCache = new Map<string, CachedImage>();
const pendingImages = new Map<string, Promise<string>>();

function isTrustedArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return url.hostname === "i.scdn.co" ||
      url.hostname === "lastfm.freetls.fastly.net" ||
      url.hostname.endsWith(".last.fm");
  } catch {
    return false;
  }
}

export async function fetchRasterImage(
  url: string,
  fetcher: typeof fetch = fetch
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!isTrustedArtworkUrl(url)) return null;

  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!SAFE_IMAGE_TYPES.has(contentType)) return null;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) return null;
    const bytes = await response.arrayBuffer();
    return bytes.byteLength <= MAX_IMAGE_BYTES ? { bytes, contentType } : null;
  } catch {
    return null;
  }
}

export async function fetchImageDataUrl(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  const image = await fetchRasterImage(url, fetcher);
  return image ? `data:${image.contentType};base64,${Buffer.from(image.bytes).toString("base64")}` : "";
}

export function getEmbeddedImage(url: string): Promise<string> {
  if (!url) return Promise.resolve("");
  const cached = imageCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.dataUrl);

  const pending = pendingImages.get(url);
  if (pending) return pending;

  const request = fetchImageDataUrl(url)
    .then((dataUrl) => {
      imageCache.set(url, {
        dataUrl,
        expiresAt: Date.now() + (dataUrl ? IMAGE_CACHE_TTL_MS : MISSING_IMAGE_CACHE_TTL_MS)
      });
      return dataUrl;
    })
    .finally(() => {
      pendingImages.delete(url);
    });
  pendingImages.set(url, request);
  return request;
}
