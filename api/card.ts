import { getNowPlayingFromEnvironment } from "../src/lastfm.js";
import { resolveLastFmUsername } from "../src/lastfm-user.js";
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
  let username: string | undefined;
  try {
    username = resolveLastFmUsername(request, process.env, ["user", "name"]);
    const data = await getNowPlayingFromEnvironment(username);
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
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const status = code === "INVALID_USERNAME" ? 400
      : code === "CUSTOM_USERS_DISABLED" ? 403
      : code === "LASTFM_USER_NOT_FOUND" ? 404
      : code === "MISSING_CONFIGURATION" ? 503
      : 502;

    return new Response(
      renderNowPlayingSvg({
        username: username ?? process.env.LASTFM_USERNAME ?? "unknown",
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
        status,
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
