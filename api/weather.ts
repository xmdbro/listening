import { fetchWeather } from "../src/weather.js";
import type { WeatherData } from "../src/types.js";

interface CachedWeather {
  data: WeatherData;
  expiresAt: number;
}

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map<string, CachedWeather>();
const pendingWeather = new Map<string, Promise<WeatherData>>();

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

async function getWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const key = cacheKey(latitude, longitude);
  const cached = weatherCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  weatherCache.delete(key);

  const existingRequest = pendingWeather.get(key);
  if (existingRequest) return existingRequest;

  const request = fetchWeather({
    apiKey: process.env.OPENWEATHERMAP_API_KEY,
    latitude,
    longitude
  })
    .then((data) => {
      weatherCache.set(key, {
        data,
        expiresAt: Date.now() + WEATHER_CACHE_TTL_MS
      });
      return data;
    })
    .finally(() => {
      pendingWeather.delete(key);
    });
  pendingWeather.set(key, request);
  return request;
}

export async function createWeatherResponse(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const latitudeValue = url.searchParams.get("lat");
    const longitudeValue = url.searchParams.get("lon");
    const latitude = latitudeValue?.trim() ? Number(latitudeValue) : Number.NaN;
    const longitude = longitudeValue?.trim() ? Number(longitudeValue) : Number.NaN;
    const weather = await getWeather(latitude, longitude);

    return Response.json(weather, {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    const status = code === "MISSING_CONFIGURATION" ? 503
      : code === "INVALID_COORDINATES" ? 400
      : 502;

    return Response.json(
      {
        error: status === 503
          ? "Weather is not configured yet."
          : status === 400
            ? "Location coordinates are invalid."
            : "Weather is temporarily unavailable.",
        detail: process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : undefined
      },
      {
        status,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}

export default {
  fetch: createWeatherResponse
};
