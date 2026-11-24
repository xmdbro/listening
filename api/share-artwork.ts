import { fetchRasterImage } from "../src/image-data.js";

function isShareArtworkUrl(url: URL): boolean {
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash) return false;

  return (url.hostname === "i.scdn.co" && /^\/image\/[a-z0-9]+$/iu.test(url.pathname)) ||
    (url.hostname === "lastfm.freetls.fastly.net" && /^\/i\/u\/[\w-]+\/[a-f0-9]+\.(?:avif|gif|jpe?g|png|webp)$/iu.test(url.pathname));
}

export function fetchShareArtwork(url: URL) {
  if (!isShareArtworkUrl(url)) return Promise.resolve(null);
  return fetchRasterImage(url.href, (source, options) => fetch(source, { ...options, redirect: "error" }));
}

export async function createShareArtworkResponse(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  const sources = new URL(request.url).searchParams.getAll("src");
  const url = sources.length === 1 ? URL.parse(sources[0]) : null;
  if (!url || !isShareArtworkUrl(url)) {
    return new Response(null, { status: 400 });
  }

  const image = await fetchShareArtwork(url);
  if (!image) return new Response(null, { status: 404 });

  return new Response(image.bytes, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default { fetch: createShareArtworkResponse };
