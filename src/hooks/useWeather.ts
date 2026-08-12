import { useEffect, useState } from "react";
import type { WeatherData } from "../types";

interface WeatherState {
  data: WeatherData | null;
  error: string | null;
  loading: boolean;
}

interface CachedWeather {
  data: WeatherData;
  expiresAt: number;
}

interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

const WEATHER_CACHE_PREFIX = "listening:weather:v1";
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const pendingWeather = new Map<string, Promise<WeatherData>>();
let browserPosition: GeolocationPosition | null = null;
let pendingPosition: Promise<GeolocationPosition> | null = null;

function getPosition(): Promise<GeolocationPosition> {
  if (browserPosition) return Promise.resolve(browserPosition);
  if (pendingPosition) return pendingPosition;

  const request = new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 15 * 60 * 1000,
      timeout: 10_000
    });
  })
    .then((position) => {
      browserPosition = position;
      return position;
    })
    .finally(() => {
      pendingPosition = null;
    });
  pendingPosition = request;
  return request;
}

function cacheKey(latitude: number, longitude: number): string {
  return `${WEATHER_CACHE_PREFIX}:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

function readCachedWeather(key: string): WeatherData | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;

    const cached = JSON.parse(value) as CachedWeather;
    if (!cached.data || !Number.isFinite(cached.expiresAt) || cached.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function writeCachedWeather(key: string, data: WeatherData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      data,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS
    } satisfies CachedWeather));
  } catch {
    // Weather still works when storage is unavailable or full.
  }
}

async function requestLocalWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const url = new URL("/api/weather", window.location.origin);
  url.search = new URLSearchParams({
    lat: latitude.toFixed(2),
    lon: longitude.toFixed(2)
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(7_000) });
  const payload = await response.json() as WeatherData & { error?: string; detail?: string };

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Weather is unavailable.");
  }

  return payload;
}

function fetchLocalWeather(
  latitude: number,
  longitude: number,
  forceRefresh = false
): Promise<WeatherData> {
  const key = cacheKey(latitude, longitude);
  if (!forceRefresh) {
    const cached = readCachedWeather(key);
    if (cached) return Promise.resolve(cached);
  }

  const existingRequest = pendingWeather.get(key);
  if (existingRequest) return existingRequest;

  const request = requestLocalWeather(latitude, longitude)
    .then((weather) => {
      writeCachedWeather(key, weather);
      return weather;
    })
    .finally(() => {
      pendingWeather.delete(key);
    });
  pendingWeather.set(key, request);
  return request;
}

export function useWeather(
  enabled: boolean,
  customCoordinates: WeatherCoordinates | null = null
): WeatherState {
  const [state, setState] = useState<WeatherState>({
    data: null,
    error: null,
    loading: false
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState((current) => ({ ...current, error: null, loading: true }));

    async function load(forceRefresh = false): Promise<void> {
      try {
        const coordinates = customCoordinates ?? (await getPosition()).coords;
        const weather = await fetchLocalWeather(
          coordinates.latitude,
          coordinates.longitude,
          forceRefresh
        );
        if (active) setState({ data: weather, error: null, loading: false });
      } catch (error) {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Weather is unavailable.",
            loading: false
          });
        }
      }
    }

    void load();
    const interval = window.setInterval(() => {
      void load(true);
    }, WEATHER_CACHE_TTL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [customCoordinates?.latitude, customCoordinates?.longitude, enabled]);

  return state;
}
