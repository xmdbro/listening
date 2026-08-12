import { setDefaultResultOrder } from "node:dns";
import type { NowPlayingData } from "./types.js";
import { getSpotifyArtworkFromEnvironment } from "./spotify.js";

setDefaultResultOrder("ipv4first");

const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const USER_AGENT = "listening/1.0.0 (personal now-playing display)";
const CACHE_TTL_MS = 5_000;
const DETAILS_CACHE_TTL_MS = 10 * 60 * 1000;
const INCOMPLETE_DETAILS_CACHE_TTL_MS = 60 * 1000;

interface LastFmImage {
  "#text"?: unknown;
}

interface LastFmTrack {
  name?: unknown;
  artist?: { "#text"?: unknown };
  album?: { "#text"?: unknown };
  image?: LastFmImage[];
  url?: unknown;
  date?: { uts?: unknown };
  "@attr"?: { nowplaying?: unknown };
}

interface LastFmPayload {
  error?: unknown;
  message?: unknown;
  recenttracks?: {
    track?: LastFmTrack[];
    "@attr"?: { total?: unknown };
  };
}

interface LastFmInfoPayload {
  error?: unknown;
  artist?: { stats?: { userplaycount?: unknown } };
  track?: { userplaycount?: unknown };
}

interface DetailedScrobbles {
  artistScrobbles: number | null;
  trackScrobbles: number | null;
}

interface DetailedScrobblesCacheEntry extends DetailedScrobbles {
  expiresAt: number;
}

let cachedResult: NowPlayingData | undefined;
let cachedUntil = 0;
const detailedScrobblesCache = new Map<string, DetailedScrobblesCacheEntry>();

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRecentTracks(
  payload: LastFmPayload,
  username: string,
  now = new Date()
): NowPlayingData {
  if (payload.error) {
    throw new Error(text(payload.message) || "Last.fm returned an error.");
  }

  const track = payload.recenttracks?.track?.[0];
  const scrobbles = numberOrNull(payload.recenttracks?.["@attr"]?.total);

  if (!track) {
    return {
      username,
      isPlaying: false,
      scrobbles,
      artistScrobbles: null,
      trackScrobbles: null,
      artistImageUrl: "",
      artistImageSourceUrl: "",
      track: null,
      updatedAt: now.toISOString()
    };
  }

  const images = Array.isArray(track.image) ? track.image : [];
  const imageUrl = [...images]
    .reverse()
    .map((image) => text(image?.["#text"]))
    .find(Boolean) ?? "";
  const playedAtUnix = Number(track.date?.uts);

  return {
    username,
    isPlaying: track["@attr"]?.nowplaying === "true",
    scrobbles,
    artistScrobbles: null,
    trackScrobbles: null,
    artistImageUrl: "",
    artistImageSourceUrl: "",
    track: {
      name: text(track.name),
      artist: text(track.artist?.["#text"]),
      album: text(track.album?.["#text"]),
      url: text(track.url),
      imageUrl,
      imageSourceUrl: text(track.url),
      playedAt: Number.isFinite(playedAtUnix)
        ? new Date(playedAtUnix * 1000).toISOString()
        : null
    },
    updatedAt: now.toISOString()
  };
}

async function fetchInfo(
  parameters: Record<string, string>,
  fetcher: typeof fetch
): Promise<LastFmInfoPayload | null> {
  const url = new URL(LASTFM_ENDPOINT);
  url.search = new URLSearchParams(parameters).toString();

  try {
    const response = await fetcher(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return null;

    const payload = await response.json() as LastFmInfoPayload;
    return payload.error ? null : payload;
  } catch {
    return null;
  }
}

export async function fetchDetailedScrobbles({
  apiKey,
  username,
  artist,
  track,
  fetcher = fetch
}: {
  apiKey: string;
  username: string;
  artist: string;
  track: string;
  fetcher?: typeof fetch;
}): Promise<DetailedScrobbles> {
  const shared = {
    api_key: apiKey,
    username,
    artist,
    autocorrect: "1",
    format: "json"
  };
  const [artistPayload, trackPayload] = await Promise.all([
    fetchInfo({ ...shared, method: "artist.getInfo" }, fetcher),
    fetchInfo({ ...shared, method: "track.getInfo", track }, fetcher)
  ]);

  return {
    artistScrobbles: numberOrNull(artistPayload?.artist?.stats?.userplaycount),
    trackScrobbles: numberOrNull(trackPayload?.track?.userplaycount)
  };
}

async function getDetailedScrobbles(
  apiKey: string,
  username: string,
  artist: string,
  track: string
): Promise<DetailedScrobbles> {
  const key = `${username}\u0000${artist}\u0000${track}`.toLocaleLowerCase();
  const cached = detailedScrobblesCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const fresh = await fetchDetailedScrobbles({ apiKey, username, artist, track });
  const result = {
    artistScrobbles: fresh.artistScrobbles ?? cached?.artistScrobbles ?? null,
    trackScrobbles: fresh.trackScrobbles ?? cached?.trackScrobbles ?? null
  };
  const complete = result.artistScrobbles !== null && result.trackScrobbles !== null;
  detailedScrobblesCache.set(key, {
    ...result,
    expiresAt: Date.now() + (
      complete ? DETAILS_CACHE_TTL_MS : INCOMPLETE_DETAILS_CACHE_TTL_MS
    )
  });
  return result;
}

export async function fetchNowPlaying({
  apiKey,
  username,
  fetcher = fetch
}: {
  apiKey?: string;
  username?: string;
  fetcher?: typeof fetch;
}): Promise<NowPlayingData> {
  if (!apiKey || !username) {
    const error = new Error(
      "Set LASTFM_API_KEY and LASTFM_USERNAME before requesting listening data."
    ) as Error & { code: string };
    error.code = "MISSING_CONFIGURATION";
    throw error;
  }

  const url = new URL(LASTFM_ENDPOINT);
  url.search = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: apiKey,
    limit: "1",
    format: "json"
  }).toString();

  const response = await fetcher(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(5_000)
  });

  if (!response.ok) {
    throw new Error(`Last.fm request failed with status ${response.status}.`);
  }

  return normalizeRecentTracks(await response.json() as LastFmPayload, username);
}

export async function getNowPlayingFromEnvironment(): Promise<NowPlayingData> {
  const now = Date.now();

  if (cachedResult && now < cachedUntil) {
    return cachedResult;
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const username = process.env.LASTFM_USERNAME;
  cachedResult = await fetchNowPlaying({
    apiKey,
    username
  });

  if (apiKey && username && cachedResult.track) {
    const [details, spotifyArtwork] = await Promise.all([
      getDetailedScrobbles(
        apiKey,
        username,
        cachedResult.track.artist,
        cachedResult.track.name
      ),
      getSpotifyArtworkFromEnvironment(
        cachedResult.track.artist,
        cachedResult.track.name
      )
    ]);
    cachedResult = {
      ...cachedResult,
      ...details,
      artistImageUrl: spotifyArtwork?.artistImageUrl ?? "",
      artistImageSourceUrl: spotifyArtwork?.artistUrl ?? "",
      track: {
        ...cachedResult.track,
        imageUrl: spotifyArtwork?.albumImageUrl || cachedResult.track.imageUrl,
        imageSourceUrl: spotifyArtwork?.albumUrl || cachedResult.track.imageSourceUrl
      }
    };
  }
  cachedUntil = now + CACHE_TTL_MS;

  return cachedResult;
}
