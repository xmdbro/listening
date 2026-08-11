import { getNowPlayingFromEnvironment } from "../src/lastfm";
import { renderNowPlayingSvg } from "../src/svg";

export async function createCardResponse(): Promise<Response> {
  try {
    const data = await getNowPlayingFromEnvironment();

    return new Response(renderNowPlayingSvg(data), {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=15, stale-while-revalidate=45",
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
