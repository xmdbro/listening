import { getNowPlayingFromEnvironment } from "../src/lastfm.js";
import { renderNowPlayingSvg } from "../src/svg.js";

export default async function handler(_request, response) {
  try {
    const data = await getNowPlayingFromEnvironment();
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=15, stale-while-revalidate=45"
    );
    response.statusCode = 200;
    response.end(renderNowPlayingSvg(data));
  } catch (error) {
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.statusCode = error?.code === "MISSING_CONFIGURATION" ? 503 : 502;
    response.end(renderNowPlayingSvg({ username: process.env.LASTFM_USERNAME, track: null }));
  }
}
