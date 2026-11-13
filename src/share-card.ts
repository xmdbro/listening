import chroma from "chroma-js";
import { getPaletteSync, type Color } from "colorthief";
import { fallbackArtworkColors, paletteFromImage } from "./hooks/useArtworkColors.js";
import { shareVisibility, type SharePreferences } from "./share-preferences.js";
import type { Track } from "./types.js";

export interface ShareTrack {
  track: Track;
  artistImageUrl: string;
  username: string;
  displayName: string;
  isPlaying: boolean;
  artistScrobbles: number | null;
  trackScrobbles: number | null;
}

type CardImage = Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">;

type CardContext<Image extends CardImage> = Pick<CanvasRenderingContext2D,
  "fillStyle" | "strokeStyle" | "lineWidth" | "font" | "textAlign" | "textBaseline" |
  "shadowColor" | "shadowBlur" | "shadowOffsetY" | "filter" | "save" | "restore" | "beginPath" |
  "rect" | "clip" | "fill" | "stroke" | "fillRect" | "strokeRect" | "moveTo" | "lineTo" |
  "createLinearGradient" | "createRadialGradient" | "measureText" | "fillText"
> & {
  drawImage(image: NoInfer<Image>, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
};

export interface ShareCardResources<Image extends CardImage = HTMLImageElement> {
  cover: Image | null;
  artistPhoto: Image | null;
  albumScrobbles: number | null;
  artworkColors: readonly [string, string];
  backgroundPresets: readonly string[];
}

export const SHARE_FORMATS = {
  square: { width: 1080, height: 1080, coverTop: 140, coverSize: 535, titleY: 766, artistY: 824, albumY: 870, footerY: 913 },
  story: { width: 1080, height: 1920, coverTop: 320, coverSize: 880, titleY: 1305, artistY: 1380, albumY: 1433, footerY: 1492 }
} as const;

const sans = '"Open Sans", Arial, sans-serif';
const mono = '"Source Code Pro", Consolas, monospace';
const countFormatter = new Intl.NumberFormat();

export function shareStats(snapshot: ShareTrack, albumScrobbles: number | null, show: SharePreferences["show"]) {
  const counts = [
    { key: "trackPlays", description: "of this track", count: snapshot.trackScrobbles },
    { key: "artistPlays", description: "by this artist", count: snapshot.artistScrobbles },
    { key: "albumPlays", description: "of this album", count: albumScrobbles }
  ] as const;

  return counts.flatMap(({ key, description, count }) => {
    if (!show[key] || count === null) return [];
    const value = countFormatter.format(count);
    return [{ label: shareVisibility[key], value, description: `${value} ${count === 1 ? "play" : "plays"} ${description}` }];
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

export function cardColors(image: HTMLImageElement | null): readonly [string, string] {
  try {
    return image ? paletteFromImage(image) : fallbackArtworkColors;
  } catch {
    return fallbackArtworkColors;
  }
}

const darkBackground = "#171820";
const fallbackBackgroundPresets = ["#536dce", "#9e387a", "#258479"];

export function backgroundPresets(cover: HTMLImageElement | null): readonly string[] {
  try {
    return presetsFromPalette(cover ? getPaletteSync(cover, { colorCount: 4, ignoreWhite: false }) : null);
  } catch {
    return fallbackBackgroundPresets;
  }
}

export function presetsFromPalette(palette: readonly Color[] | null): readonly string[] {
  const colors = [...(palette ?? [])]
    .sort((left, right) => right.population - left.population)
    .map((color) => color.hex())
    .filter((color) => color !== "#000000");
  return [...new Set([...colors, ...fallbackBackgroundPresets])].slice(0, 3);
}

function readableColor(foreground: string, background: string): string {
  if (chroma.contrast(foreground, background) >= 4.5) return foreground;
  return chroma.contrast("#ffffff", background) >= 4.5 ? "#ffffff" : "#000000";
}

function drawCroppedImage<Image extends CardImage>(context: CardContext<Image>, image: Image, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height
  );
}

function drawBackgroundPhoto<Image extends CardImage>(context: CardContext<Image>, photo: Image, width: number, height: number, blur: boolean, blurFallback?: () => void): void {
  if (!blur) {
    drawCroppedImage(context, photo, 0, 0, width, height);
    return;
  }

  if (typeof context.filter !== "string" && blurFallback) {
    blurFallback();
    return;
  }

  const inset = 72;
  context.save();
  context.filter = "blur(24px)";
  drawCroppedImage(context, photo, -inset, -inset, width + 2 * inset, height + 2 * inset);
  context.restore();
}

export function drawSharePreview(canvas: HTMLCanvasElement, snapshot: ShareTrack, preferences: SharePreferences, resources: ShareCardResources): void {
  const { width, height } = SHARE_FORMATS[preferences.format];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The card preview is unavailable in this browser.");

  drawShareCard(context, snapshot, preferences, resources, (photo) => {
    // Browsers without canvas filters can soften the image by downsampling.
    const sample = document.createElement("canvas");
    sample.width = 24;
    sample.height = Math.round(24 * height / width);
    const sampleContext = sample.getContext("2d");
    if (!sampleContext) return;
    drawCroppedImage(sampleContext, photo, 0, 0, sample.width, sample.height);
    context.drawImage(sample, 0, 0, width, height);
  });
}

function drawCover<Image extends CardImage>(context: CardContext<Image>, image: Image | null, x: number, y: number, size: number): void {
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
    drawCroppedImage(context, image, x, y, size, size);
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

function fitText(context: Pick<CanvasRenderingContext2D, "measureText">, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;

  let fitted = "";
  const segments = graphemes ? Array.from(graphemes.segment(text), ({ segment }) => segment) : text;
  for (const segment of segments) {
    if (context.measureText(`${fitted}${segment}…`).width > width) break;
    fitted += segment;
  }
  return `${fitted.trimEnd()}…`;
}

export function drawShareCard<Image extends CardImage>(context: CardContext<Image>, snapshot: ShareTrack, preferences: SharePreferences, { cover, artistPhoto, albumScrobbles, artworkColors, backgroundPresets }: ShareCardResources<Image>, blurFallback?: (photo: Image) => void): void {
  const { format, background, backgroundColor, blur, color, show } = preferences;
  const { width, height, coverTop, coverSize, titleY, artistY, albumY, footerY } = SHARE_FORMATS[format];
  const solidColor = background === "solid" ? backgroundColor : null;
  const gradientColor = background === "gradient"
    ? backgroundColor ?? (color === "artwork" && cover ? backgroundPresets[0] : "#50566c")
    : null;
  const gradientStart = gradientColor ? chroma.mix(darkBackground, gradientColor, 0.86, "rgb").hex() : null;
  const [titleColor, artistColor, primaryText, secondaryText] = [
    ...(color === "artwork" ? artworkColors : fallbackArtworkColors),
    ...fallbackArtworkColors
  ].map((foreground) => solidColor ? readableColor(foreground, solidColor) : foreground);
  const margin = format === "story" ? 100 : 76;
  const contentWidth = width - margin * 2;
  const headerY = coverTop - 42;
  context.fillStyle = solidColor ?? darkBackground;
  context.fillRect(0, 0, width, height);
  const photo = background === "artist" ? artistPhoto : background === "album" ? cover : null;
  if (photo) {
    drawBackgroundPhoto(context, photo, width, height, blur, blurFallback && (() => blurFallback(photo)));
    const shade = context.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, "rgba(12, 12, 15, 0.72)");
    shade.addColorStop(0.27, "rgba(12, 12, 15, 0.42)");
    shade.addColorStop(artistY / height, "rgba(12, 12, 15, 0.87)");
    shade.addColorStop(1, "rgba(12, 12, 15, 0.95)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  } else if (gradientColor && gradientStart) {
    const gradient = context.createLinearGradient(0, 0, width * 0.55, height);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(0.55, chroma.mix(darkBackground, gradientColor, 0.48, "rgb").hex());
    gradient.addColorStop(0.78, chroma.mix(darkBackground, gradientColor, 0.18, "rgb").hex());
    gradient.addColorStop(1, "#0c0c0f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  } else if (background !== "solid") {
    const glowY = coverTop + coverSize / 3;
    const glow = context.createRadialGradient(width / 2, glowY, 32, width / 2, glowY, width * 0.72);
    const glowColor = cover ? artistColor : "#8186a3";
    glow.addColorStop(0, `${glowColor}52`);
    glow.addColorStop(1, `${glowColor}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    const shade = context.createLinearGradient(0, 0, 0, height);
    shade.addColorStop((coverTop + coverSize / 2) / height, "rgba(12, 12, 15, 0)");
    shade.addColorStop(1, "#0c0c0f");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  }

  drawCover(context, cover, (width - coverSize) / 2, coverTop, coverSize);

  if (gradientStart) {
    context.shadowColor = "rgba(0, 0, 0, 0.75)";
    context.shadowBlur = 5;
  }
  if (show.status) {
    context.fillStyle = secondaryText;
    context.font = `400 27px ${mono}`;
    context.fillText(snapshot.isPlaying ? "NOW PLAYING" : "LAST PLAYED", margin, headerY);
  }
  if (show.displayName) {
    context.fillStyle = primaryText;
    context.font = `400 32px ${sans}`;
    context.textAlign = "right";
    context.fillText(fitText(context, snapshot.displayName, show.status ? contentWidth - 270 : contentWidth), width - margin, headerY);
  }
  context.shadowColor = "transparent";

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
  const showAlbum = show.album && Boolean(snapshot.track.album);
  if (showAlbum) {
    context.font = `300 32px ${sans}`;
    context.fillStyle = secondaryText;
    context.fillText(fitText(context, snapshot.track.album, contentWidth), margin, albumY);
  }

  const stats = shareStats(snapshot, albumScrobbles, show);
  if (stats.length) {
    const statsY = showAlbum ? footerY : albumY + 4;
    context.strokeStyle = `${primaryText}33`;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin, statsY);
    context.lineTo(width - margin, statsY);
    context.stroke();

    const columnWidth = contentWidth / stats.length;
    stats.forEach(({ label, value }, index) => {
      const x = margin + columnWidth * index;
      context.font = `400 42px ${sans}`;
      context.fillStyle = primaryText;
      context.fillText(value, x, statsY + 60, columnWidth - 24);
      context.font = `400 25px ${mono}`;
      context.fillStyle = secondaryText;
      context.fillText(label.toUpperCase(), x, statsY + 98);
    });
  }
}
