import {
  defaultSharePreferences, shareBackgrounds, shareColors, shareFormats, shareVisibility, type SharePreferences
} from "./share-preferences.js";

const visibilityKeys = Object.keys(shareVisibility) as Array<keyof typeof shareVisibility>;
export const shareLinkParameters = ["user", "name", "format", "background", "bgColor", "blur", "color", "hide"];

export function shareImageUrl(origin: string, account: { username: string; displayName: string }, preferences: SharePreferences): string {
  const { format, background, backgroundColor, blur, color, show } = preferences;
  const url = new URL("/share.png", origin);
  url.search = new URLSearchParams({ user: account.username, format, background, blur: blur ? "1" : "0", color }).toString();
  if (show.displayName && account.displayName !== account.username) url.searchParams.set("name", account.displayName.slice(0, 256));
  if (backgroundColor && (background === "gradient" || background === "solid")) url.searchParams.set("bgColor", backgroundColor.slice(1));
  const hidden = visibilityKeys.filter((key) => !show[key]);
  if (hidden.length) url.searchParams.set("hide", hidden.join(","));
  return url.href;
}

export function parseShareImagePreferences(query: URLSearchParams): SharePreferences {
  const { format, background, blur, color, bgColor, hide } = Object.fromEntries(query);
  const hidden = hide === undefined ? [] : hide.split(",");
  if (
    (format !== undefined && !Object.hasOwn(shareFormats, format)) ||
    (background !== undefined && !Object.hasOwn(shareBackgrounds, background)) ||
    (color !== undefined && !Object.hasOwn(shareColors, color)) ||
    (blur !== undefined && blur !== "0" && blur !== "1") ||
    (bgColor !== undefined && !/^[0-9a-f]{6}$/i.test(bgColor)) ||
    hidden.some((key) => !Object.hasOwn(shareVisibility, key))
  ) throw new Error("Invalid share card options.");

  const defaults = defaultSharePreferences;
  const show = { ...defaults.show };
  for (const key of visibilityKeys) show[key] = !hidden.includes(key);
  return {
    format: (format as SharePreferences["format"] | undefined) ?? defaults.format,
    background: (background as SharePreferences["background"] | undefined) ?? defaults.background,
    backgroundColor: bgColor ? `#${bgColor.toLowerCase()}` : null,
    blur: blur === undefined ? defaults.blur : blur === "1",
    color: (color as SharePreferences["color"] | undefined) ?? defaults.color,
    show
  };
}
