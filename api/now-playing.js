import { getNowPlayingFromEnvironment } from "../src/lastfm.js";

export default async function handler(_request, response) {
  try {
    const data = await getNowPlayingFromEnvironment();
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=15, stale-while-revalidate=45"
    );
    response.statusCode = 200;
    response.end(JSON.stringify(data));
  } catch (error) {
    const missingConfiguration = error?.code === "MISSING_CONFIGURATION";
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.statusCode = missingConfiguration ? 503 : 502;
    response.end(JSON.stringify({
      error: missingConfiguration ? "Listening is not configured yet." : "Listening data is temporarily unavailable.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined
    }));
  }
}
