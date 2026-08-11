const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MISSING_IMAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

export async function fetchImageDataUrl(
  url: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (!isTrustedArtworkUrl(url)) return "";

  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return "";

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!contentType.startsWith("image/")) return "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return "";
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
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
