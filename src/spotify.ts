const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_ENDPOINT = "https://api.spotify.com/v1";
const ARTWORK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INCOMPLETE_ARTWORK_CACHE_TTL_MS = 60 * 1000;

interface SpotifyImage {
  url?: unknown;
}

interface SpotifyExternalUrls {
  spotify?: unknown;
}

interface SpotifySearchPayload {
  tracks?: {
    items?: Array<{
      name?: unknown;
      external_urls?: SpotifyExternalUrls;
      album?: {
        images?: SpotifyImage[];
        external_urls?: SpotifyExternalUrls;
      };
      artists?: Array<{
        id?: unknown;
        name?: unknown;
        external_urls?: SpotifyExternalUrls;
      }>;
    }>;
  };
}

interface SpotifyArtistPayload {
  images?: SpotifyImage[];
  external_urls?: SpotifyExternalUrls;
}

interface SpotifyTokenPayload {
  access_token?: unknown;
  expires_in?: unknown;
}

export interface SpotifyArtwork {
  albumImageUrl: string;
  albumUrl: string;
  artistImageUrl: string;
  artistUrl: string;
}

interface CachedArtwork {
  artwork: SpotifyArtwork | null;
  expiresAt: number;
}

let accessToken = "";
let accessTokenExpiresAt = 0;
let pendingAccessToken: Promise<string> | null = null;
const artworkCache = new Map<string, CachedArtwork>();
const pendingArtwork = new Map<string, Promise<SpotifyArtwork | null>>();

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function requestAccessToken({
  clientId,
  clientSecret,
  fetcher
}: {
  clientId: string;
  clientSecret: string;
  fetcher: typeof fetch;
}): Promise<string> {
  const response = await fetcher(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) return "";

  const payload = await response.json() as SpotifyTokenPayload;
  const token = text(payload.access_token);
  const expiresIn = Number(payload.expires_in);
  if (!token) return "";

  accessToken = token;
  const lifetimeSeconds = Number.isFinite(expiresIn) ? Math.max(30, expiresIn - 60) : 3_000;
  accessTokenExpiresAt = Date.now() + lifetimeSeconds * 1000;
  return token;
}

async function getAccessToken({
  clientId,
  clientSecret,
  fetcher
}: {
  clientId: string;
  clientSecret: string;
  fetcher: typeof fetch;
}): Promise<string> {
  if (accessToken && accessTokenExpiresAt > Date.now()) return accessToken;
  if (pendingAccessToken) return pendingAccessToken;

  pendingAccessToken = requestAccessToken({ clientId, clientSecret, fetcher })
    .finally(() => {
      pendingAccessToken = null;
    });
  return pendingAccessToken;
}

export async function fetchSpotifyArtwork({
  clientId,
  clientSecret,
  artist,
  track,
  fetcher = fetch
}: {
  clientId: string;
  clientSecret: string;
  artist: string;
  track: string;
  fetcher?: typeof fetch;
}): Promise<SpotifyArtwork | null> {
  try {
    const token = await getAccessToken({ clientId, clientSecret, fetcher });
    if (!token) return null;

    const searchUrl = new URL(`${SPOTIFY_API_ENDPOINT}/search`);
    searchUrl.search = new URLSearchParams({
      q: `track:${track} artist:${artist}`,
      type: "track",
      limit: "1"
    }).toString();
    const searchResponse = await fetcher(searchUrl, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000)
    });
    if (!searchResponse.ok) return null;

    const search = await searchResponse.json() as SpotifySearchPayload;
    const result = search.tracks?.items?.[0];
    if (!result) return null;

    const requestedArtist = normalizeName(artist);
    const matchedArtist = result.artists?.find((item) =>
      normalizeName(text(item.name)) === requestedArtist
    ) ?? result.artists?.[0];
    const artistId = text(matchedArtist?.id);
    const artwork: SpotifyArtwork = {
      albumImageUrl: text(result.album?.images?.[0]?.url),
      albumUrl: text(result.album?.external_urls?.spotify) || text(result.external_urls?.spotify),
      artistImageUrl: "",
      artistUrl: text(matchedArtist?.external_urls?.spotify)
    };

    if (!artistId) return artwork;
    const artistResponse = await fetcher(`${SPOTIFY_API_ENDPOINT}/artists/${artistId}`, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000)
    });
    if (!artistResponse.ok) return artwork;

    const artistPayload = await artistResponse.json() as SpotifyArtistPayload;
    return {
      ...artwork,
      artistImageUrl: text(artistPayload.images?.[0]?.url),
      artistUrl: text(artistPayload.external_urls?.spotify) || artwork.artistUrl
    };
  } catch {
    return null;
  }
}

export function getSpotifyArtworkFromEnvironment(
  artist: string,
  track: string
): Promise<SpotifyArtwork | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret || !artist || !track) return Promise.resolve(null);

  const key = `${artist}\u0000${track}`.toLocaleLowerCase();
  const cached = artworkCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.artwork);

  const pending = pendingArtwork.get(key);
  if (pending) return pending;

  const request = fetchSpotifyArtwork({ clientId, clientSecret, artist, track })
    .then((artwork) => {
      const hasCompleteArtwork = Boolean(artwork?.albumImageUrl && artwork.artistImageUrl);
      artworkCache.set(key, {
        artwork,
        expiresAt: Date.now() + (
          hasCompleteArtwork ? ARTWORK_CACHE_TTL_MS : INCOMPLETE_ARTWORK_CACHE_TTL_MS
        )
      });
      return artwork;
    })
    .finally(() => {
      pendingArtwork.delete(key);
    });
  pendingArtwork.set(key, request);
  return request;
}
