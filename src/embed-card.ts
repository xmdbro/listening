export const embedWidths = { standard: 620, compact: 480 };
export const maxEmbedWidth = 4096;
export const embedViewBox = { width: embedWidths.standard, height: 164 };
export const embedVisibility = {
  cover: "Album cover",
  name: "Display name",
  status: "Playback status",
  album: "Album name",
  total: "Total scrobbles",
  plays: "Personal track plays"
};

type EmbedField = keyof typeof embedVisibility;
const fields = Object.keys(embedVisibility) as EmbedField[];

export interface EmbedOptions {
  width: number;
  backgroundColor: string | null;
  titleColor: string | null;
  show: Record<EmbedField, boolean>;
}

export const defaultEmbedOptions: EmbedOptions = {
  width: embedWidths.standard,
  backgroundColor: null,
  titleColor: null,
  show: { cover: true, name: true, status: true, album: true, total: true, plays: false }
};

export function embedDimensions(width: number): { width: number; height: number } {
  return { width, height: Math.max(1, Math.round(width * embedViewBox.height / embedViewBox.width)) };
}

export const embedQueryParameters = ["user", "name", "size", "width", "bg", "accent", ...fields.map((field) => `show-${field}`)];

export class InvalidEmbedOptions extends Error {}

export function parseEmbedWidth(value: string): number | null {
  if (!value || /\D/.test(value)) return null;
  const width = Number(value);
  return width >= 1 && width <= maxEmbedWidth ? width : null;
}

function parseColor(value: string | null): string | null {
  if (value === null) return null;
  if (value.length !== 6 || !/^[0-9a-f]+$/i.test(value)) throw new InvalidEmbedOptions();
  return `#${value.toLowerCase()}`;
}

export function parseEmbedOptions(query: URLSearchParams): EmbedOptions {
  const defaults = defaultEmbedOptions;
  const size = query.get("size");
  const requestedWidth = query.get("width");
  const width = requestedWidth === null
    ? embedWidths[size === "compact" ? "compact" : "standard"]
    : parseEmbedWidth(requestedWidth);
  if (width === null || (size !== null && (requestedWidth !== null || (size !== "standard" && size !== "compact")))) {
    throw new InvalidEmbedOptions();
  }
  const show = { ...defaults.show };
  for (const field of fields) {
    const value = query.get(`show-${field}`);
    if (value === null) continue;
    if (value !== "0" && value !== "1") throw new InvalidEmbedOptions();
    show[field] = value === "1";
  }

  return {
    width,
    backgroundColor: parseColor(query.get("bg")),
    titleColor: parseColor(query.get("accent")),
    show
  };
}

export function embedCardUrl(
  origin: string,
  username: string,
  displayName: string,
  { width, backgroundColor, titleColor, show }: EmbedOptions
): string {
  const url = new URL("/now.svg", origin);
  const defaults = defaultEmbedOptions;
  const name = displayName.trim();
  url.searchParams.set("user", username);
  if (name && name !== username && show.name) url.searchParams.set("name", name);
  if (width === embedWidths.compact) url.searchParams.set("size", "compact");
  else if (width !== embedWidths.standard) url.searchParams.set("width", String(width));
  if (backgroundColor) url.searchParams.set("bg", backgroundColor.slice(1));
  if (titleColor) url.searchParams.set("accent", titleColor.slice(1));
  for (const field of fields) {
    if (show[field] !== defaults.show[field]) url.searchParams.set(`show-${field}`, show[field] ? "1" : "0");
  }
  return url.href;
}

export function embedSnippet(url: string, format: "HTML" | "Markdown", options: EmbedOptions): string {
  const alt = "Live Last.fm listening card";
  if (format === "Markdown") return `![${alt}](<${url}>)`;
  const { width, height } = embedDimensions(options.width);
  return `<img src="${url.replaceAll("&", "&amp;")}" width="${width}" height="${height}" alt="${alt}">`;
}
