import { setDefaultResultOrder } from "node:dns";
import type { NowPlayingData } from "./types.js";
import { getSpotifyArtworkFromEnvironment } from "./spotify.js";

setDefaultResultOrder("ipv4first");

const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const USER_AGENT = "listening/1.0.0 (personal now-playing display)";
const CACHE_TTL_MS = 5_000;
const DETAILS_CACHE_TTL_MS = 10 * 60 * 1000;
const INCOMPLETE_DETAILS_CACHE_TTL_MS = 60 * 1000;
const MAX_NOW_PLAYING_CACHE_ENTRIES = 100;
const MAX_DETAILS_CACHE_ENTRIES = 1_000;

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

interface NowPlayingCacheEntry {
  data: NowPlayingData;
  expiresAt: number;
}

const nowPlayingCache = new Map<string, NowPlayingCacheEntry>();
const pendingNowPlaying = new Map<string, Promise<NowPlayingData>>();
const detailedScrobblesCache = new Map<string, DetailedScrobblesCacheEntry>();
const pendingDetailedScrobbles = new Map<string, Promise<DetailedScrobbles>>();

function cacheKeyPart(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function readCache<Key, Value>(cache: Map<Key, Value>, key: Key): Value | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeBoundedCache<Key, Value>(
  cache: Map<Key, Value>,
  key: Key,
  value: Value,
  maximumEntries: number
): void {
  cache.delete(key);
  while (cache.size >= maximumEntries) {
    const oldestKey = cache.keys().next().value as Key | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
}

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
  const key = [username, artist, track].map(cacheKeyPart).join("\u0000");
  const cached = readCache(detailedScrobblesCache, key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const existingRequest = pendingDetailedScrobbles.get(key);
  if (existingRequest) return existingRequest;

  const request = fetchDetailedScrobbles({ apiKey, username, artist, track })
    .then((fresh) => {
      const result = {
        artistScrobbles: fresh.artistScrobbles ?? cached?.artistScrobbles ?? null,
        trackScrobbles: fresh.trackScrobbles ?? cached?.trackScrobbles ?? null
      };
      const complete = result.artistScrobbles !== null && result.trackScrobbles !== null;
      writeBoundedCache(detailedScrobblesCache, key, {
        ...result,
        expiresAt: Date.now() + (
          complete ? DETAILS_CACHE_TTL_MS : INCOMPLETE_DETAILS_CACHE_TTL_MS
        )
      }, MAX_DETAILS_CACHE_ENTRIES);
      return result;
    })
    .finally(() => pendingDetailedScrobbles.delete(key));
  pendingDetailedScrobbles.set(key, request);
  return request;
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
  if (!apiKey) {
    const error = new Error(
      "Set LASTFM_API_KEY before requesting listening data."
    ) as Error & { code: string };
    error.code = "MISSING_CONFIGURATION";
    throw error;
  }
  if (!username) {
    const error = new Error(
      "Enter a Last.fm username in Listening preferences or set LASTFM_USERNAME."
    ) as Error & { code: string };
    error.code = "MISSING_LASTFM_USERNAME";
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

  const payload = await response.json() as LastFmPayload;
  if (payload.error) {
    const error = new Error(text(payload.message) || "Last.fm returned an error.") as Error & {
      code: string;
    };
    error.code = Number(payload.error) === 6 ? "LASTFM_USER_NOT_FOUND" : "LASTFM_ERROR";
    throw error;
  }
  return normalizeRecentTracks(payload, username);
}

export async function getNowPlayingFromEnvironment(
  requestedUsername?: string
): Promise<NowPlayingData> {
  const apiKey = process.env.LASTFM_API_KEY;
  const username = requestedUsername?.trim() || process.env.LASTFM_USERNAME?.trim();
  const key = cacheKeyPart(username ?? "");
  const cached = readCache(nowPlayingCache, key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const existingRequest = pendingNowPlaying.get(key);
  if (existingRequest) return existingRequest;

  const request = fetchNowPlaying({ apiKey, username })
    .then(async (result) => {
      if (apiKey && username && result.track) {
        const [details, spotifyArtwork] = await Promise.all([
          getDetailedScrobbles(
            apiKey,
            username,
            result.track.artist,
            result.track.name
          ),
          getSpotifyArtworkFromEnvironment(
            result.track.artist,
            result.track.name
          )
        ]);
        result = {
          ...result,
          ...details,
          artistImageUrl: spotifyArtwork?.artistImageUrl ?? "",
          artistImageSourceUrl: spotifyArtwork?.artistUrl ?? "",
          track: {
            ...result.track,
            imageUrl: spotifyArtwork?.albumImageUrl || result.track.imageUrl,
            imageSourceUrl: spotifyArtwork?.albumUrl || result.track.imageSourceUrl
          }
        };
      }

      writeBoundedCache(nowPlayingCache, key, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL_MS
      }, MAX_NOW_PLAYING_CACHE_ENTRIES);
      return result;
    })
    .finally(() => pendingNowPlaying.delete(key));
  pendingNowPlaying.set(key, request);
  return request;
}
