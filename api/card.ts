import { getNowPlayingFromEnvironment } from "../src/lastfm";
import { getEmbeddedImage } from "../src/image-data";
import { renderNowPlayingSvg } from "../src/svg";

function cardCacheControl(): string {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  return isProduction
    ? "public, max-age=60, s-maxage=15, stale-while-revalidate=45"
    : "no-store";
}

export async function createCardResponse(): Promise<Response> {
  try {
    const data = await getNowPlayingFromEnvironment();
    const coverUrl = data.track?.imageUrl ?? "";
    const backgroundUrl = data.artistImageUrl || coverUrl;
    const coverPromise = getEmbeddedImage(coverUrl);
    const backgroundPromise = backgroundUrl === coverUrl
      ? coverPromise
      : getEmbeddedImage(backgroundUrl);
    const [cover, background] = await Promise.all([coverPromise, backgroundPromise]);

    return new Response(renderNowPlayingSvg(data, { cover, background }), {
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
      }),
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
  fetch: createCardResponse
};
