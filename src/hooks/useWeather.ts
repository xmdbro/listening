import { useEffect, useState } from "react";
import type { WeatherData } from "../types";
import { fetchWeather } from "../weather";

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
        const weather = await fetchWeather(
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

