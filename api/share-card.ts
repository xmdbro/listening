import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { extractPalette, MmcqQuantizer, validateOptions } from "colorthief/internals";
import { artworkTextColors } from "../src/hooks/useArtworkColors.js";
import { getAlbumScrobbles, getNowPlayingFromEnvironment } from "../src/lastfm.js";
import { resolveLastFmUsername } from "../src/lastfm-user.js";
import { drawShareCard, presetsFromPalette, SHARE_FORMATS } from "../src/share-card.js";
import { parseShareImagePreferences, shareLinkParameters } from "../src/share-link.js";
import { fetchShareArtwork } from "./share-artwork.js";

const require = createRequire(import.meta.url);
const quantizer = new MmcqQuantizer();
let fontsReady = false;

function registerFonts(): void {
  if (fontsReady) return;
  GlobalFonts.register(readFileSync(require.resolve("@fontsource/open-sans/files/open-sans-latin-300-normal.woff2")));
  GlobalFonts.register(readFileSync(require.resolve("@fontsource/open-sans/files/open-sans-latin-400-normal.woff2")));
  GlobalFonts.register(readFileSync(require.resolve("@fontsource/source-code-pro/files/source-code-pro-latin-400-normal.woff2")), "Source Code Pro");
  fontsReady = true;
}

async function loadArtwork(source: string) {
  const url = URL.parse(source);
  if (!url) return null;
  const image = await fetchShareArtwork(url);
  if (!image) return null;

  try {
    return await loadImage(new Uint8Array(image.bytes));
  } catch {
    return null;
  }
}

export async function createShareCardResponse(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const query = new URL(request.url).searchParams;
  const name = query.get("name")?.trim();
  let username: string | undefined;
  let preferences;
  try {
    username = resolveLastFmUsername(request, process.env, shareLinkParameters);
    preferences = parseShareImagePreferences(query);
    if (name && name.length > 256) throw new Error("Display name is too long.");
  } catch (error) {
    const forbidden = error instanceof Error && "code" in error && error.code === "CUSTOM_USERS_DISABLED";
    return new Response(forbidden ? "Custom Last.fm users are disabled." : "Invalid share card parameters.", { status: forbidden ? 403 : 400 });
  }

  try {
    const data = await getNowPlayingFromEnvironment(username);
    const { track } = data;
    if (!track) return new Response("No track is available for this account.", { status: 404 });

    const coverRequest = loadArtwork(track.imageUrl);
    const artistRequest = preferences.background === "artist"
      ? data.artistImageUrl === track.imageUrl ? coverRequest : loadArtwork(data.artistImageUrl)
      : null;
    const [cover, artistPhoto, albumScrobbles] = await Promise.all([
      coverRequest,
      artistRequest,
      preferences.show.albumPlays && track.artist && track.album
        ? getAlbumScrobbles(data.username, track.artist, track.album) : null
    ]);

    let artworkColors = artworkTextColors([]);
    let backgroundPresets = presetsFromPalette(null);
    if (cover && preferences.color === "artwork") {
      const scale = Math.min(1, 640 / Math.max(cover.naturalWidth, cover.naturalHeight));
      const width = Math.max(1, Math.round(cover.naturalWidth * scale));
      const height = Math.max(1, Math.round(cover.naturalHeight * scale));
      const sample = createCanvas(width, height).getContext("2d");
      sample.drawImage(cover, 0, 0, width, height);
      const pixels = sample.getImageData(0, 0, width, height).data;
      artworkColors = artworkTextColors(extractPalette(pixels, width, height, validateOptions({ colorCount: 3 }), quantizer) ?? []);
      if (preferences.background === "gradient" && preferences.backgroundColor === null) {
        backgroundPresets = presetsFromPalette(extractPalette(pixels, width, height, validateOptions({ colorCount: 4, ignoreWhite: false }), quantizer));
      }
    }

    registerFonts();
    const { width, height } = SHARE_FORMATS[preferences.format];
    const canvas = createCanvas(width, height);
    drawShareCard(canvas.getContext("2d"), {
      track,
      username: data.username,
      displayName: name || data.username,
      artistImageUrl: data.artistImageUrl,
      isPlaying: data.isPlaying,
      artistScrobbles: data.artistScrobbles,
      trackScrobbles: data.trackScrobbles
    }, preferences, { cover, artistPhoto, albumScrobbles, artworkColors, backgroundPresets });

    return new Response(request.method === "HEAD" ? null : new Uint8Array(await canvas.encode("png")), {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=45",
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const status = code === "LASTFM_USER_NOT_FOUND" ? 404
      : code === "MISSING_CONFIGURATION" || code === "MISSING_LASTFM_USERNAME" ? 503 : 502;
    return new Response("The share card is unavailable.", { status, headers: { "Cache-Control": "no-store" } });
  }
}

export default { fetch: createShareCardResponse };
