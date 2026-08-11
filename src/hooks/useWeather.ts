import { useEffect, useState } from "react";
import type { WeatherData } from "../types";

interface WeatherState {
  data: WeatherData | null;
  error: string | null;
  loading: boolean;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 15 * 60 * 1000,
      timeout: 10_000
    });
  });
}

async function fetchLocalWeather(latitude: number, longitude: number): Promise<WeatherData> {
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

export function useWeather(enabled: boolean): WeatherState {
  const [state, setState] = useState<WeatherState>({
    data: null,
    error: null,
    loading: false
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState((current) => ({ ...current, error: null, loading: true }));

    async function load(): Promise<void> {
      try {
        const position = await getPosition();
        const weather = await fetchLocalWeather(
          position.coords.latitude,
          position.coords.longitude
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
    return () => { active = false; };
  }, [enabled]);

  return state;
}
