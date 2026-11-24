import { embedQueryParameters, InvalidEmbedOptions, parseEmbedOptions, type EmbedOptions } from "../src/embed-card.js";
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

export async function createCardResponse(request?: Request): Promise<Response> {
  const query = request ? new URL(request.url).searchParams : new URLSearchParams();
  const displayName = (query.get("name") ?? "").trim().slice(0, 40);
  let username: string | undefined;
  let options: EmbedOptions | undefined;
  try {
    username = resolveLastFmUsername(request, process.env, embedQueryParameters);
    // Keep the original SVG output for URLs using only the original parameters.
    if ([...query.keys()].some((key) => key !== "user" && key !== "name")) {
      options = parseEmbedOptions(query);
    }
    const data = await getNowPlayingFromEnvironment(username);
    const artwork = data.track?.imageUrl ?? "";
    const coverUrl = options?.show.cover === false ? "" : artwork;
    const backgroundUrl = options?.backgroundColor ? "" : data.artistImageUrl || artwork;
    const coverPromise = getEmbeddedImage(coverUrl);
    const backgroundPromise = backgroundUrl === coverUrl
      ? coverPromise
      : getEmbeddedImage(backgroundUrl);
    const [cover, background] = await Promise.all([coverPromise, backgroundPromise]);

    return new Response(renderNowPlayingSvg(data, { cover, background, displayName }, undefined, options), {
      headers: {
        "Cache-Control": cardCacheControl(),
        "Content-Type": "image/svg+xml; charset=utf-8"
      }
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const status = code === "INVALID_USERNAME" || error instanceof InvalidEmbedOptions ? 400
      : code === "CUSTOM_USERS_DISABLED" ? 403
      : code === "LASTFM_USER_NOT_FOUND" ? 404
      : code === "MISSING_LASTFM_USERNAME" ? 503
      : code === "MISSING_CONFIGURATION" ? 503
      : 502;

    return new Response(
      renderNowPlayingSvg({
        username: username ?? process.env.LASTFM_USERNAME ?? "unknown",
        isPlaying: false,
        scrobbles: null,
        artistScrobbles: null,
        trackScrobbles: null,
        trackLoved: null,
        artistImageUrl: "",
        artistImageSourceUrl: "",
        track: null,
        updatedAt: new Date().toISOString()
      }, { displayName }, undefined, options),
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
