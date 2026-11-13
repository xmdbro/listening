export const shareFormats = { square: "Square", story: "Story" } as const;
export const shareBackgrounds = { artist: "Artist photo", album: "Album art", gradient: "Gradient", solid: "Solid color" } as const;
export const shareColors = { artwork: "Artwork colors", neutral: "Neutral" } as const;
export const shareVisibility = {
  displayName: "Display name",
  status: "Playback status",
  album: "Album name",
  trackPlays: "Track plays",
  artistPlays: "Artist plays",
  albumPlays: "Album plays"
} as const;

export type ShareFormat = keyof typeof shareFormats;

export interface SharePreferences {
  format: ShareFormat;
  background: keyof typeof shareBackgrounds;
  backgroundColor: string | null;
  blur: boolean;
  color: keyof typeof shareColors;
  show: Record<keyof typeof shareVisibility, boolean>;
}

export const defaultSharePreferences: SharePreferences = {
  format: "square",
  background: "artist",
  backgroundColor: null,
  blur: true,
  color: "artwork",
  show: { displayName: true, status: true, album: true, trackPlays: true, artistPlays: true, albumPlays: true }
};

const storageKey = "listening:share-card:v1";

export function loadSharePreferences(): SharePreferences {
  try {
    const value: Partial<SharePreferences> | null = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const preferences = { ...defaultSharePreferences, show: { ...defaultSharePreferences.show } };
    if (value?.format === "square" || value?.format === "story") preferences.format = value.format;
    if (value?.background && Object.hasOwn(shareBackgrounds, value.background)) preferences.background = value.background;
    if (typeof value?.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(value.backgroundColor)) {
      preferences.backgroundColor = value.backgroundColor.toLowerCase();
    }
    if (value?.color === "artwork" || value?.color === "neutral") preferences.color = value.color;
    if (typeof value?.blur === "boolean") preferences.blur = value.blur;
    for (const key of Object.keys(shareVisibility) as Array<keyof typeof shareVisibility>) {
      const visible = value?.show?.[key];
      if (typeof visible === "boolean") preferences.show[key] = visible;
    }
    return preferences;
  } catch {
    return defaultSharePreferences;
  }
}

export function saveSharePreferences(preferences: SharePreferences): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Choices still apply to the open card when storage is unavailable.
  }
}
