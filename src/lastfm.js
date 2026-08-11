const LASTFM_ENDPOINT = "https://ws.audioscrobbler.com/2.0/";
const CACHE_TTL_MS = 10_000;

let cachedResult;
let cachedUntil = 0;

function text(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeRecentTracks(payload, username, now = new Date()) {
  if (payload?.error) {
    throw new Error(text(payload.message) || "Last.fm returned an error.");
  }

  const track = payload?.recenttracks?.track?.[0];

  if (!track) {
    return {
      username,
      isPlaying: false,
      track: null,
      updatedAt: now.toISOString()
    };
  }

  const images = Array.isArray(track.image) ? track.image : [];
  const imageUrl = [...images]
    .reverse()
    .map((image) => text(image?.["#text"]))
    .find(Boolean) || "";

  const playedAtUnix = Number(track?.date?.uts);

  return {
    username,
    isPlaying: track?.["@attr"]?.nowplaying === "true",
    track: {
      name: text(track.name),
      artist: text(track.artist?.["#text"]),
      album: text(track.album?.["#text"]),
      url: text(track.url),
      imageUrl,
      playedAt: Number.isFinite(playedAtUnix)
        ? new Date(playedAtUnix * 1000).toISOString()
        : null
    },
    updatedAt: now.toISOString()
  };
}

export async function fetchNowPlaying({ apiKey, username, fetcher = fetch }) {
  if (!apiKey || !username) {
    const error = new Error(
      "Set LASTFM_API_KEY and LASTFM_USERNAME before requesting listening data."
    );
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
    headers: { "user-agent": "listening/0.1 (personal now-playing display)" },
    signal: AbortSignal.timeout(5_000)
  });

  if (!response.ok) {
    throw new Error(`Last.fm request failed with status ${response.status}.`);
  }

  return normalizeRecentTracks(await response.json(), username);
}

export async function getNowPlayingFromEnvironment() {
  const now = Date.now();

  if (cachedResult && now < cachedUntil) {
    return cachedResult;
  }

  cachedResult = await fetchNowPlaying({
    apiKey: process.env.LASTFM_API_KEY,
    username: process.env.LASTFM_USERNAME
  });
  cachedUntil = now + CACHE_TTL_MS;

  return cachedResult;
}

