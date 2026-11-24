import chroma from "chroma-js";
import { defaultEmbedOptions, embedDimensions, embedViewBox, type EmbedOptions } from "./embed-card.js";
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

function escapeEmbedXml(value: unknown): string {
  return escapeXml(value).replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "");
}

function truncate(value: unknown, length: number): string {
  const string = String(value ?? "");
  return string.length > length ? `${string.slice(0, length - 3)}...` : string;
}

function truncateEmbedText(value: unknown, length: number): string {
  const string = String(value ?? "");
  const characters = Array.from(string);
  return characters.length > length ? `${characters.slice(0, length - 3).join("")}...` : string;
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

const formatCount = new Intl.NumberFormat("en-US");

function textClip(id: string, x: number, y: number, width: number, height: number): string {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" /></clipPath>`;
}

export function renderNowPlayingSvg(
  data: NowPlayingData,
  images: NowPlayingSvgImages = {},
  now = new Date(),
  options?: EmbedOptions
): string {
  const { width: requestedWidth, backgroundColor, titleColor, show } = options ?? defaultEmbedOptions;
  const { width, height } = embedDimensions(requestedWidth);
  const { width: viewWidth, height: viewHeight } = embedViewBox;
  const escape = options ? escapeEmbedXml : escapeXml;
  const limitText = options ? truncateEmbedText : truncate;
  const coverSize = 120;
  const coverX = 22;
  const coverY = 22;
  const left = show.cover ? 166 : 24;
  const right = viewWidth - 24;
  const headerY = 37;
  const titleY = 77;
  const artistY = 108;
  const footerY = 135;
  const hasTrack = Boolean(data.track);
  const title = hasTrack ? limitText(data.track?.name, 34) : "Nothing in the air...";
  const artist = hasTrack
    ? limitText(data.track?.artist, 40)
    : show.name ? `last.fm/user/${data.username || "unknown"}` : "Last.fm";
  const album = hasTrack ? limitText(data.track?.album, 45) : "Waiting for the next track";
  const status = show.status ? formatListeningStatus(data, now) : "";
  const displayName = limitText(images.displayName?.trim() || data.username, 40);
  const userLine = status ? `${displayName} ${data.isPlaying ? "is listening" : "last listened"}` : displayName;
  const scrobbles = show.total && data.scrobbles !== null ? `${formatCount.format(data.scrobbles)} scrobbles` : "";
  const trackPlays = show.plays && data.trackScrobbles !== null
    ? `${formatCount.format(data.trackScrobbles)} track ${data.trackScrobbles === 1 ? "play" : "plays"}` : "";
  const lightBackground = backgroundColor !== null && chroma.contrast("#ffffff", backgroundColor) < 4.5;
  const textColor = lightBackground ? "#101013" : "#f7f7f7";
  const secondary = backgroundColor ? textColor : "#c4c4c4";
  const artistColor = backgroundColor ? textColor : "#d9d7de";
  const edgeColor = lightBackground ? "#000000" : "#ffffff";
  const background = backgroundColor ? "" : images.background || images.cover;

  const backgroundImage = background
    ? `<image href="${escape(background)}" x="-24" y="-24" width="${viewWidth + 48}" height="${viewHeight + 44}" preserveAspectRatio="xMidYMid slice" filter="url(#background-blur)" />`
    : "";
  const coverImage = images.cover
    ? `<image href="${escape(images.cover)}" x="${coverX}" y="${coverY}" width="${coverSize}" height="${coverSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover-clip)" />`
    : `<rect x="${coverX}" y="${coverY}" width="${coverSize}" height="${coverSize}" rx="2" fill="#35384a" />
       <text x="${coverX + coverSize / 2}" y="${coverY + coverSize / 2 + 16}" text-anchor="middle" fill="#c4c4c4" font-family="Arial, sans-serif" font-size="32">&#9835;</text>`;
  const description = [`${title} by ${artist}`, status].filter(Boolean).join(", ");
  const stats = [scrobbles, trackPlays].filter(Boolean);
  const clipAttribute = (id: string) => options ? ` clip-path="url(#${id})"` : "";
  const textClips = options ? `
    ${textClip("name-clip", left, headerY - 16, right - left - (status ? 130 : 0), 23)}
    ${textClip("track-clip", left, titleY - 30, right - left, artistY - titleY + 38)}
    ${textClip("album-clip", left, footerY - 16, right - left - (stats.length ? 142 : 0), 23)}` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-labelledby="card-title card-description">
  <title id="card-title">${escape(status ? `${status}: ${title}` : title)}</title>
  <desc id="card-description">${escape(description)}</desc>
  <defs>
    <linearGradient id="fallback-background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#35384a" />
      <stop offset="1" stop-color="#171820" />
    </linearGradient>
    <filter id="background-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
    <clipPath id="card-clip"><rect width="${viewWidth}" height="${viewHeight}" rx="10" /></clipPath>
    <clipPath id="cover-clip"><rect x="${coverX}" y="${coverY}" width="${coverSize}" height="${coverSize}" rx="2" /></clipPath>${textClips}
  </defs>
  <g clip-path="url(#card-clip)">
    <rect width="${viewWidth}" height="${viewHeight}" fill="${escape(backgroundColor ?? "url(#fallback-background)")}" />
    ${backgroundImage}
    ${backgroundColor ? "" : `<rect width="${viewWidth}" height="${viewHeight}" fill="#000000" fill-opacity="0.68" />`}
    ${show.cover ? `${coverImage}
    <rect x="${coverX + 0.5}" y="${coverY + 0.5}" width="${coverSize - 1}" height="${coverSize - 1}" rx="2" fill="none" stroke="#ffffff" stroke-opacity="0.12" />` : ""}
  </g>
  <rect x="0.5" y="0.5" width="${viewWidth - 1}" height="${viewHeight - 1}" rx="10" fill="none" stroke="${edgeColor}" stroke-opacity="0.14" />
  ${show.name ? `<text x="${left}" y="${headerY}"${clipAttribute("name-clip")} fill="${textColor}" fill-opacity="${backgroundColor ? 1 : 0.78}" font-family="'Open Sans', Arial, sans-serif" font-size="13" font-weight="300">${escape(userLine)}</text>` : ""}
  ${status ? `<text x="${right}" y="${headerY}" text-anchor="end" fill="${textColor}" fill-opacity="${backgroundColor ? 1 : 0.7}" font-family="'Source Code Pro', Consolas, monospace" font-size="11">${escape(status)}</text>` : ""}
  <text x="${left}" y="${titleY}"${clipAttribute("track-clip")} fill="${escape(titleColor ?? textColor)}" font-family="'Open Sans', Arial, sans-serif" font-size="24" font-weight="300">${escape(title)}</text>
  <text x="${left}" y="${artistY}"${clipAttribute("track-clip")} fill="${artistColor}" font-family="'Open Sans', Arial, sans-serif" font-size="17" font-weight="300">${escape(artist)}</text>
  ${show.album ? `<text x="${left}" y="${footerY}"${clipAttribute("album-clip")} fill="${secondary}" font-family="'Open Sans', Arial, sans-serif" font-size="12" font-weight="300">${escape(album)}</text>` : ""}
  ${stats.map((label, index) => `<text x="${right}" y="${footerY + index * 14}" text-anchor="end" fill="${secondary}" font-family="'Source Code Pro', Consolas, monospace" font-size="10">${escape(label)}</text>`).join("\n  ")}
</svg>`;
}
