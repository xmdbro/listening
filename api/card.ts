import { getNowPlayingFromEnvironment } from "../src/lastfm.js";
import { getEmbeddedImage } from "../src/image-data.js";
import { renderNowPlayingSvg } from "../src/svg.js";

function cardCacheControl(): string {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  return isProduction
    ? "public, max-age=60, s-maxage=15, stale-while-revalidate=45"
    : "no-store";
}

function cardDisplayName(request?: Request): string {
  const requested = request
    ? new URL(request.url).searchParams.get("name")?.trim()
    : "";
  return (requested || "").slice(0, 40);
}

export async function createCardResponse(request?: Request): Promise<Response> {
  const displayName = cardDisplayName(request);
  try {
    const data = await getNowPlayingFromEnvironment();
    const coverUrl = data.track?.imageUrl ?? "";
    const backgroundUrl = data.artistImageUrl || coverUrl;
    const coverPromise = getEmbeddedImage(coverUrl);
    const backgroundPromise = backgroundUrl === coverUrl
      ? coverPromise
      : getEmbeddedImage(backgroundUrl);
    const [cover, background] = await Promise.all([coverPromise, backgroundPromise]);

    return new Response(renderNowPlayingSvg(data, { cover, background, displayName }), {
      headers: {
        "Cache-Control": cardCacheControl(),
        "Content-Type": "image/svg+xml; charset=utf-8"
      }
    });
  } catch (error) {
    const missingConfiguration =
      error instanceof Error && "code" in error && error.code === "MISSING_CONFIGURATION";

    return new Response(
      renderNowPlayingSvg({
        username: process.env.LASTFM_USERNAME ?? "unknown",
        isPlaying: false,
        scrobbles: null,
        artistScrobbles: null,
        trackScrobbles: null,
        artistImageUrl: "",
        artistImageSourceUrl: "",
        track: null,
        updatedAt: new Date().toISOString()
      }, { displayName }),
      {
        status: missingConfiguration ? 503 : 502,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "image/svg+xml; charset=utf-8"
        }
      }
    );
  }
}

export default {
  fetch: (request: Request) => createCardResponse(request)
};
