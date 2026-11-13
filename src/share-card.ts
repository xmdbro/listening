import { fallbackArtworkColors, paletteFromImage } from "./hooks/useArtworkColors";
import type { Track } from "./types";

export interface ShareTrack {
  track: Track;
  username: string;
  displayName: string;
  isPlaying: boolean;
  artistScrobbles: number | null;
  trackScrobbles: number | null;
}

export const SHARE_FORMATS = {
  square: { label: "Square", width: 1080, height: 1080, coverTop: 140, coverSize: 535, titleY: 766, artistY: 824, albumY: 870, footerY: 913 },
  story: { label: "Story", width: 1080, height: 1920, coverTop: 320, coverSize: 880, titleY: 1305, artistY: 1380, albumY: 1433, footerY: 1492 }
} as const;

export type ShareFormat = keyof typeof SHARE_FORMATS;

const sans = '"Open Sans", Arial, sans-serif';
const mono = '"Source Code Pro", Consolas, monospace';
const countFormatter = new Intl.NumberFormat();

export function shareStats(snapshot: ShareTrack, albumScrobbles: number | null) {
  const counts = [
    { label: "Track plays", description: "of this track", count: snapshot.trackScrobbles },
    { label: "Artist plays", description: "by this artist", count: snapshot.artistScrobbles },
    { label: "Album plays", description: "of this album", count: albumScrobbles }
  ];

  return counts.flatMap(({ label, description, count }) => {
    if (count === null) return [];
    const value = countFormatter.format(count);
    return [{ label, value, description: `${value} ${count === 1 ? "play" : "plays"} ${description}` }];
  });
}

export async function loadShareAlbumScrobbles({ track, username }: ShareTrack, signal: AbortSignal): Promise<number | null> {
  if (!track.album.trim() || !track.artist.trim()) return null;

  const query = new URLSearchParams({ user: username, artist: track.artist, album: track.album });
  try {
    const response = await fetch(`/api/share-album?${query}`, { signal });
    if (!response.ok) return null;
    const { albumScrobbles } = await response.json();
    return typeof albumScrobbles === "number" && Number.isSafeInteger(albumScrobbles) && albumScrobbles >= 0 ? albumScrobbles : null;
  } catch {
    return null;
  }
}

export async function loadShareArtwork(source: string, signal: AbortSignal): Promise<HTMLImageElement | null> {
  if (!source) return null;

  const query = new URLSearchParams({ src: source });
  try {
    const response = await fetch(`/api/share-artwork?${query}`, { signal });
    if (!response.ok) return null;

    const image = new Image();
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function cardColors(image: HTMLImageElement | null): readonly [string, string] {
  try {
    return image ? paletteFromImage(image) : fallbackArtworkColors;
  } catch {
    return fallbackArtworkColors;
  }
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, size: number): void {
  context.save();
  context.beginPath();
  context.rect(x, y, size, size);
  context.shadowColor = "rgba(0, 0, 0, 0.56)";
  context.shadowBlur = 64;
  context.shadowOffsetY = 26;
  context.fillStyle = "#35384a";
  context.fill();
  context.shadowColor = "transparent";
  context.clip();

  if (image) {
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, x, y, size, size);
  } else {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `300 ${Math.round(size * 0.16)}px ${sans}`;
    context.fillStyle = "#c4c4c4";
    context.fillText("♪", x + size / 2, y + size / 2);
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 3;
  context.strokeRect(x, y, size, size);
  context.restore();
}

const graphemes = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function fitText(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;

  let fitted = "";
  const segments = graphemes ? Array.from(graphemes.segment(text), ({ segment }) => segment) : text;
  for (const segment of segments) {
    if (context.measureText(`${fitted}${segment}…`).width > width) break;
    fitted += segment;
  }
  return `${fitted.trimEnd()}…`;
}

export function drawShareCard(canvas: HTMLCanvasElement, snapshot: ShareTrack, format: ShareFormat, artwork: HTMLImageElement | null, albumScrobbles: number | null): void {
  const { width, height, coverTop, coverSize, titleY, artistY, albumY, footerY } = SHARE_FORMATS[format];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The card preview is unavailable in this browser.");

  const [titleColor, artistColor] = cardColors(artwork);
  const margin = format === "story" ? 100 : 76;
  const contentWidth = width - margin * 2;
  const headerY = coverTop - 42;
  const glow = context.createRadialGradient(width / 2, coverTop + coverSize / 3, 32, width / 2, coverTop + coverSize / 3, width * 0.72);
  const glowColor = artwork ? artistColor : "#8186a3";
  glow.addColorStop(0, `${glowColor}52`);
  glow.addColorStop(1, `${glowColor}00`);

  context.fillStyle = "#171820";
  context.fillRect(0, 0, width, height);
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  const shade = context.createLinearGradient(0, coverTop + coverSize / 2, 0, height);
  shade.addColorStop(0, "rgba(12, 12, 15, 0)");
  shade.addColorStop(1, "#0c0c0f");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);

  drawCover(context, artwork, (width - coverSize) / 2, coverTop, coverSize);

  context.fillStyle = "#c4c4c4";
  context.font = `400 27px ${mono}`;
  context.fillText(snapshot.isPlaying ? "NOW PLAYING" : "LAST PLAYED", margin, headerY);
  context.fillStyle = "#f7f7f7";
  context.font = `400 32px ${sans}`;
  context.textAlign = "right";
  context.fillText(fitText(context, snapshot.displayName, contentWidth - 270), width - margin, headerY);

  context.textAlign = "left";
  const titleSize = format === "story" ? 76 : 68;
  context.font = `300 ${titleSize}px ${sans}`;
  const titleWidth = context.measureText(snapshot.track.name).width;
  const fittedSize = Math.max(44, Math.min(titleSize, Math.floor(titleSize * contentWidth / titleWidth)));
  context.font = `300 ${fittedSize}px ${sans}`;
  context.fillStyle = titleColor;
  context.fillText(fitText(context, snapshot.track.name, contentWidth), margin, titleY);
  context.font = `300 ${format === "story" ? 45 : 40}px ${sans}`;
  context.fillStyle = artistColor;
  context.fillText(fitText(context, snapshot.track.artist, contentWidth), margin, artistY);
  if (snapshot.track.album) {
    context.font = `300 32px ${sans}`;
    context.fillStyle = "#c4c4c4";
    context.fillText(fitText(context, snapshot.track.album, contentWidth), margin, albumY);
  }

  const stats = shareStats(snapshot, albumScrobbles);
  if (stats.length) {
    context.strokeStyle = "rgba(255, 255, 255, 0.2)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin, footerY);
    context.lineTo(width - margin, footerY);
    context.stroke();

    const columnWidth = contentWidth / stats.length;
    stats.forEach(({ label, value }, index) => {
      const x = margin + columnWidth * index;
      context.font = `400 42px ${sans}`;
      context.fillStyle = "#f7f7f7";
      context.fillText(value, x, footerY + 60, columnWidth - 24);
      context.font = `400 25px ${mono}`;
      context.fillStyle = "#c4c4c4";
      context.fillText(label.toUpperCase(), x, footerY + 98);
    });
  }
}
