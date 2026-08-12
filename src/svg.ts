import type { NowPlayingData } from "./types.js";

export interface NowPlayingSvgImages {
  background?: string;
  cover?: string;
  displayName?: string;
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value: unknown, length: number): string {
  const string = String(value ?? "");
  return string.length > length ? `${string.slice(0, length - 3)}...` : string;
}

function plural(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"} ago`;
}

export function formatListeningStatus(data: NowPlayingData, now = new Date()): string {
  if (data.isPlaying) return "now playing";

  const playedAt = Date.parse(data.track?.playedAt ?? data.updatedAt);
  if (!Number.isFinite(playedAt)) return "last played";
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - playedAt) / 60_000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return plural(elapsedMinutes, "minute");

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return plural(elapsedHours, "hour");
  return plural(Math.floor(elapsedHours / 24), "day");
}

function formatScrobbles(value: number | null): string {
  return value === null ? "" : `${new Intl.NumberFormat("en-US").format(value)} scrobbles`;
}

export function renderNowPlayingSvg(
  data: NowPlayingData,
  images: NowPlayingSvgImages = {},
  now = new Date()
): string {
  const hasTrack = Boolean(data.track);
  const title = hasTrack ? truncate(data.track?.name, 34) : "Nothing in the air...";
  const artist = hasTrack ? truncate(data.track?.artist, 40) : `last.fm/user/${data.username || "unknown"}`;
  const album = hasTrack ? truncate(data.track?.album, 45) : "Waiting for the next track";
  const status = formatListeningStatus(data, now);
  const displayName = truncate(images.displayName?.trim() || data.username, 40);
  const userLine = data.isPlaying ? `${displayName} is listening` : `${displayName} last listened`;
  const scrobbles = formatScrobbles(data.scrobbles);
  const background = images.background || images.cover;

  const backgroundImage = background
    ? `<image href="${escapeXml(background)}" x="-24" y="-24" width="668" height="208" preserveAspectRatio="xMidYMid slice" filter="url(#background-blur)" />`
    : "";
  const coverImage = images.cover
    ? `<image href="${escapeXml(images.cover)}" x="22" y="22" width="120" height="120" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover-clip)" />`
    : `<rect x="22" y="22" width="120" height="120" rx="2" fill="#35384a" />
       <text x="82" y="98" text-anchor="middle" fill="#c4c4c4" font-family="Arial, sans-serif" font-size="32">&#9835;</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="164" viewBox="0 0 620 164" role="img" aria-labelledby="card-title card-description">
  <title id="card-title">${escapeXml(status)}: ${escapeXml(title)}</title>
  <desc id="card-description">${escapeXml(title)} by ${escapeXml(artist)}, ${escapeXml(status)}</desc>
  <defs>
    <linearGradient id="fallback-background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#35384a" />
      <stop offset="1" stop-color="#171820" />
    </linearGradient>
    <filter id="background-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
    <clipPath id="card-clip"><rect width="620" height="164" rx="10" /></clipPath>
    <clipPath id="cover-clip"><rect x="22" y="22" width="120" height="120" rx="2" /></clipPath>
  </defs>
  <g clip-path="url(#card-clip)">
    <rect width="620" height="164" fill="url(#fallback-background)" />
    ${backgroundImage}
    <rect width="620" height="164" fill="#000000" fill-opacity="0.68" />
    ${coverImage}
    <rect x="22.5" y="22.5" width="119" height="119" rx="2" fill="none" stroke="#ffffff" stroke-opacity="0.12" />
  </g>
  <rect x="0.5" y="0.5" width="619" height="163" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.14" />
  <text x="166" y="37" fill="#f7f7f7" fill-opacity="0.78" font-family="'Open Sans', Arial, sans-serif" font-size="13" font-weight="300">${escapeXml(userLine)}</text>
  <text x="596" y="37" text-anchor="end" fill="#f7f7f7" fill-opacity="0.7" font-family="'Source Code Pro', Consolas, monospace" font-size="11">${escapeXml(status)}</text>
  <text x="166" y="77" fill="#f7f7f7" font-family="'Open Sans', Arial, sans-serif" font-size="24" font-weight="300">${escapeXml(title)}</text>
  <text x="166" y="108" fill="#d9d7de" font-family="'Open Sans', Arial, sans-serif" font-size="17" font-weight="300">${escapeXml(artist)}</text>
  <text x="166" y="135" fill="#c4c4c4" font-family="'Open Sans', Arial, sans-serif" font-size="12" font-weight="300">${escapeXml(album)}</text>
  ${scrobbles ? `<text x="596" y="135" text-anchor="end" fill="#c4c4c4" font-family="'Source Code Pro', Consolas, monospace" font-size="10">${escapeXml(scrobbles)}</text>` : ""}
</svg>`;
}
