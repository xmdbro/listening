export type BackgroundType = "artist" | "album" | "none";

export interface Preferences {
  displayName: string;
  weather: boolean;
  time: boolean;
  extended: boolean;
  backgroundType: BackgroundType;
  blurBackground: boolean;
  weatherLatitude: string;
  weatherLongitude: string;
  use24HourTime: boolean;
  showWeekday: boolean;
  showSeconds: boolean;
}

export type Feature = "weather" | "time" | "extended";

export const defaultPreferences: Preferences = {
  displayName: "",
  weather: true,
  time: true,
  extended: true,
  backgroundType: "artist",
  blurBackground: true,
  weatherLatitude: "",
  weatherLongitude: "",
  use24HourTime: true,
  showWeekday: false,
  showSeconds: true
};

const SETTINGS_KEY = "listening:settings:v1";
const LEGACY_FEATURES_KEY = "listening:features";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return defaultPreferences;

  const next = { ...defaultPreferences };
  const booleanKeys: Array<keyof Preferences> = [
    "weather",
    "time",
    "extended",
    "blurBackground",
    "use24HourTime",
    "showWeekday",
    "showSeconds"
  ];
  for (const key of booleanKeys) {
    if (typeof value[key] === "boolean") {
      (next[key] as boolean) = value[key];
    }
  }

  if (value.backgroundType === "artist" || value.backgroundType === "album" || value.backgroundType === "none") {
    next.backgroundType = value.backgroundType;
  }
  if (typeof value.displayName === "string") next.displayName = value.displayName;
  if (typeof value.weatherLatitude === "string") next.weatherLatitude = value.weatherLatitude;
  if (typeof value.weatherLongitude === "string") next.weatherLongitude = value.weatherLongitude;
  return next;
}

export function loadPreferences(storage: Pick<Storage, "getItem"> = localStorage): Preferences {
  try {
    const settings = storage.getItem(SETTINGS_KEY);
    if (settings) return mergePreferences(JSON.parse(settings));

    const legacyFeatures = storage.getItem(LEGACY_FEATURES_KEY);
    return legacyFeatures
      ? mergePreferences(JSON.parse(legacyFeatures))
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage: Pick<Storage, "setItem"> = localStorage
): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
  } catch {
    // The live settings still apply when storage is unavailable or full.
  }
}

export function customWeatherCoordinates(preferences: Preferences): {
  latitude: number;
  longitude: number;
} | null {
  const latitude = Number(preferences.weatherLatitude);
  const longitude = Number(preferences.weatherLongitude);
  if (
    !preferences.weatherLatitude.trim()
    || !preferences.weatherLongitude.trim()
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function validateWeatherCoordinates(preferences: Preferences): string | null {
  const hasLatitude = Boolean(preferences.weatherLatitude.trim());
  const hasLongitude = Boolean(preferences.weatherLongitude.trim());
  if (!hasLatitude && !hasLongitude) return null;
  if (!hasLatitude || !hasLongitude) return "Enter both coordinates, or leave both blank for automatic location.";
  if (!customWeatherCoordinates(preferences)) return "Latitude must be -90 to 90 and longitude must be -180 to 180.";
  return null;
}
