import type { WeatherData } from "./types";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
  };
  current_units?: {
    temperature_2m?: string;
  };
}

const descriptions: Array<{ codes: number[]; label: string; symbol: string }> = [
  { codes: [0], label: "Clear sky", symbol: "☀" },
  { codes: [1], label: "Mainly clear", symbol: "☀" },
  { codes: [2], label: "Partly cloudy", symbol: "◒" },
  { codes: [3], label: "Overcast", symbol: "☁" },
  { codes: [45, 48], label: "Foggy", symbol: "≋" },
  { codes: [51, 53, 55, 56, 57], label: "Drizzle", symbol: "☂" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: "Rain", symbol: "☂" },
  { codes: [71, 73, 75, 77, 85, 86], label: "Snow", symbol: "✳" },
  { codes: [95, 96, 99], label: "Thunderstorm", symbol: "ϟ" }
];

export function describeWeather(code: number): { label: string; symbol: string } {
  const description = descriptions.find((candidate) => candidate.codes.includes(code));
  return description
    ? { label: description.label, symbol: description.symbol }
    : { label: "Current conditions", symbol: "○" };
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch
): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    temperature_unit: "celsius",
    timezone: "auto"
  }).toString();

  const response = await fetcher(url, { signal: AbortSignal.timeout(6_000) });
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}.`);
  }

  const payload = await response.json() as OpenMeteoResponse;
  const current = payload.current;
  if (
    typeof current?.temperature_2m !== "number" ||
    typeof current.apparent_temperature !== "number" ||
    typeof current.weather_code !== "number"
  ) {
    throw new Error("Weather data was incomplete.");
  }

  const description = describeWeather(current.weather_code);
  return {
    ...description,
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    unit: payload.current_units?.temperature_2m ?? "°C"
  };
}
