import { getNowPlayingFromEnvironment } from "../src/lastfm";

export async function createNowPlayingResponse(): Promise<Response> {
  try {
    const data = await getNowPlayingFromEnvironment();

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=45"
      }
    });
  } catch (error) {
    const missingConfiguration =
      error instanceof Error && "code" in error && error.code === "MISSING_CONFIGURATION";

    return Response.json(
      {
        error: missingConfiguration
          ? "Listening is not configured yet."
          : "Listening data is temporarily unavailable.",
        detail: process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : undefined
      },
      {
        status: missingConfiguration ? 503 : 502,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}

export default {
  fetch: createNowPlayingResponse
};

