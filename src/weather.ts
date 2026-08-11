import type { WeatherData } from "./types";

const OPENWEATHERMAP_ENDPOINT = "https://api.openweathermap.org/data/2.5/weather";

interface OpenWeatherMapPayload {
  weather?: Array<{
    description?: unknown;
    icon?: unknown;
  }>;
  main?: {
    temp?: unknown;
    feels_like?: unknown;
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Current conditions";
}

export function weatherSymbol(icon: string): string {
  const symbols: Record<string, string> = {
    "01": "☀",
    "02": "◒",
    "03": "☁",
    "04": "☁",
    "09": "☂",
    "10": "☂",
    "11": "ϟ",
    "13": "✳",
    "50": "≋"
  };
  return symbols[icon.slice(0, 2)] ?? "○";
}

export function normalizeOpenWeatherMap(payload: OpenWeatherMapPayload): WeatherData {
  const condition = payload.weather?.[0];
  const temperature = Number(payload.main?.temp);
  const apparentTemperature = Number(payload.main?.feels_like);
  const icon = text(condition?.icon);

  if (!Number.isFinite(temperature) || !Number.isFinite(apparentTemperature)) {
    throw new Error("Weather data was incomplete.");
  }

  return {
    label: capitalize(text(condition?.description)),
    symbol: weatherSymbol(icon),
    icon,
    temperature,
    apparentTemperature,
    unit: "°C"
  };
}

export async function fetchWeather({
  apiKey,
  latitude,
  longitude,
  fetcher = fetch
}: {
  apiKey?: string;
  latitude: number;
  longitude: number;
  fetcher?: typeof fetch;
}): Promise<WeatherData> {
  if (!apiKey) {
    const error = new Error(
      "Set OPENWEATHERMAP_API_KEY before requesting weather data."
    ) as Error & { code: string };
    error.code = "MISSING_CONFIGURATION";
    throw error;
  }

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    const error = new Error("Latitude or longitude is invalid.") as Error & { code: string };
    error.code = "INVALID_COORDINATES";
    throw error;
  }

  const url = new URL(OPENWEATHERMAP_ENDPOINT);
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    units: "metric",
    appid: apiKey
  }).toString();

  const response = await fetcher(url, { signal: AbortSignal.timeout(6_000) });
  if (!response.ok) {
    throw new Error(`OpenWeatherMap request failed with status ${response.status}.`);
  }

  return normalizeOpenWeatherMap(await response.json() as OpenWeatherMapPayload);
}

