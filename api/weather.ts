import { fetchWeather } from "../src/weather";

export async function createWeatherResponse(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    const weather = await fetchWeather({
      apiKey: process.env.OPENWEATHERMAP_API_KEY,
      latitude,
      longitude
    });

    return Response.json(weather, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300"
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

