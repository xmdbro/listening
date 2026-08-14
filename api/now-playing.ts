import { getNowPlayingFromEnvironment } from "../src/lastfm.js";
import { resolveLastFmUsername } from "../src/lastfm-user.js";

function errorStatus(code: unknown): number {
  if (code === "INVALID_USERNAME") return 400;
  if (code === "CUSTOM_USERS_DISABLED") return 403;
  if (code === "LASTFM_USER_NOT_FOUND") return 404;
  if (code === "MISSING_LASTFM_USERNAME") return 503;
  if (code === "MISSING_CONFIGURATION") return 503;
  return 502;
}

export async function createNowPlayingResponse(request?: Request): Promise<Response> {
  try {
    const username = resolveLastFmUsername(request);
    const data = await getNowPlayingFromEnvironment(username);

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=15"
      }
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const status = errorStatus(code);
    const publicMessage = status === 400
      ? "The Last.fm username is invalid."
      : status === 403
        ? "Custom Last.fm users are disabled on this deployment."
        : status === 404
          ? "That Last.fm user could not be found."
          : code === "MISSING_LASTFM_USERNAME"
            ? "Please enter a Last.fm username in Listening preferences [s]."
          : status === 503
            ? "Listening is not configured yet."
            : "Listening data is temporarily unavailable.";

    return Response.json(
      {
        error: publicMessage,
        detail: (status === 400 || process.env.NODE_ENV === "development") && error instanceof Error
          ? error.message
          : undefined
      },
      {
        status,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}

export default {
  fetch: (request: Request) => createNowPlayingResponse(request)
};
