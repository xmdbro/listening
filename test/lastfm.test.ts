import assert from "node:assert/strict";
import { getDefaultResultOrder } from "node:dns";
import test from "node:test";
import {
  fetchDetailedScrobbles,
  fetchNowPlaying,
  getNowPlayingFromEnvironment,
  normalizeRecentTracks
} from "../src/lastfm";
import { resolveLastFmUsername } from "../src/lastfm-user";
import { formatListeningStatus, renderNowPlayingSvg } from "../src/svg";
import { normalizeOpenWeatherMap, weatherIconClass, weatherSymbol } from "../src/weather";

test("prefers IPv4 for Last.fm requests", () => {
  assert.equal(getDefaultResultOrder(), "ipv4first");
});

test("normalizes a currently playing Last.fm track", () => {
  const now = new Date("2026-08-12T00:00:00.000Z");
  const result = normalizeRecentTracks({
    recenttracks: {
      "@attr": { total: "108442" },
      track: [{
        name: "Cattails",
        artist: { "#text": "Big Thief" },
        album: { "#text": "U.F.O.F." },
        image: [
          { "#text": "" },
          { "#text": "https://example.com/cover.jpg" }
        ],
        url: "https://last.fm/example",
        "@attr": { nowplaying: "true" }
      }]
    }
  }, "lance", now);

  assert.equal(result.isPlaying, true);
  assert.equal(result.scrobbles, 108442);
  assert.equal(result.artistScrobbles, null);
  assert.equal(result.trackScrobbles, null);
  assert.equal(result.artistImageUrl, "");
  assert.equal(result.artistImageSourceUrl, "");
  assert.equal(result.track?.name, "Cattails");
  assert.equal(result.track?.artist, "Big Thief");
  assert.equal(result.track?.imageUrl, "https://example.com/cover.jpg");
  assert.equal(result.track?.imageSourceUrl, "https://last.fm/example");
  assert.equal(result.updatedAt, now.toISOString());
});

test("loads personal artist and track scrobble counts", async () => {
  const requestedMethods: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requestedMethods.push(url.searchParams.get("method") ?? "");
    assert.equal(url.searchParams.get("username"), "lance");
    assert.equal(url.searchParams.get("autocorrect"), "1");

    return Response.json(url.searchParams.get("method") === "artist.getInfo"
      ? { artist: { stats: { userplaycount: "212" } } }
      : { track: { userplaycount: "156" } });
  }) as typeof fetch;

  const result = await fetchDetailedScrobbles({
    apiKey: "key",
    username: "lance",
    artist: "An artist",
    track: "A song",
    fetcher
  });

  assert.deepEqual(result, {
    artistScrobbles: 212,
    trackScrobbles: 156
  });
  assert.deepEqual(requestedMethods.sort(), ["artist.getInfo", "track.getInfo"]);
});

test("encodes a selected username as a Last.fm query parameter", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://ws.audioscrobbler.com");
    assert.equal(url.searchParams.get("user"), "name&method=evil");
    assert.equal(url.searchParams.get("method"), "user.getrecenttracks");
    return Response.json({ recenttracks: { track: [] } });
  }) as typeof fetch;

  const result = await fetchNowPlaying({
    apiKey: "key",
    username: "name&method=evil",
    fetcher
  });
  assert.equal(result.username, "name&method=evil");
});

test("isolates account status caches and deduplicates requests per user", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.LASTFM_API_KEY;
  const requestedUsers: string[] = [];
  process.env.LASTFM_API_KEY = "cache-test-key";
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const username = url.searchParams.get("user") ?? "";
    requestedUsers.push(username);
    return Response.json({
      recenttracks: {
        "@attr": { total: username === "cache-user-a" ? "10" : "20" },
        track: []
      }
    });
  }) as typeof fetch;

  try {
    const [first, duplicate, second] = await Promise.all([
      getNowPlayingFromEnvironment("cache-user-a"),
      getNowPlayingFromEnvironment("cache-user-a"),
      getNowPlayingFromEnvironment("cache-user-b")
    ]);
    assert.equal(first.scrobbles, 10);
    assert.equal(duplicate.scrobbles, 10);
    assert.equal(second.scrobbles, 20);
    assert.deepEqual(requestedUsers.sort(), ["cache-user-a", "cache-user-b"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.LASTFM_API_KEY;
    else process.env.LASTFM_API_KEY = originalApiKey;
  }
});

test("protects a configured username unless custom users are enabled", () => {
  const request = new Request("https://example.com/api/now-playing?user=other-user");
  assert.throws(
    () => resolveLastFmUsername(request, { LASTFM_USERNAME: "default-user" }),
    (error: unknown) => error instanceof Error
      && "code" in error
      && error.code === "CUSTOM_USERS_DISABLED"
  );
  assert.equal(resolveLastFmUsername(request, {
    LASTFM_USERNAME: "default-user",
    ALLOW_CUSTOM_LASTFM_USERS: "true"
  }), "other-user");
  assert.equal(resolveLastFmUsername(
    new Request("https://example.com/api/now-playing"),
    { LASTFM_USERNAME: "default-user" }
  ), "default-user");
  assert.equal(resolveLastFmUsername(
    new Request("https://example.com/api/now-playing"),
    { LASTFM_USERNAME: "   " }
  ), undefined);
  assert.equal(resolveLastFmUsername(
    new Request("https://example.com/api/now-playing?user=chosen-user"),
    { LASTFM_USERNAME: "" }
  ), "chosen-user");
});

test("rejects duplicate or oversized username queries", () => {
  const environment = {
    LASTFM_USERNAME: "default-user",
    ALLOW_CUSTOM_LASTFM_USERS: "true"
  };
  assert.throws(() => resolveLastFmUsername(
    new Request("https://example.com/api/now-playing?user=one&user=two"),
    environment
  ), /only one/i);
  assert.throws(() => resolveLastFmUsername(
    new Request(`https://example.com/api/now-playing?user=${"x".repeat(65)}`),
    environment
  ), /64 characters/i);
  assert.throws(() => resolveLastFmUsername(
    new Request("https://example.com/api/now-playing?user=one&unused=value"),
    environment
  ), /unsupported query parameter/i);
});

test("keeps an available detail count when the other Last.fm lookup fails", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return url.searchParams.get("method") === "artist.getInfo"
      ? Response.json({ artist: { stats: { userplaycount: "108" } } })
      : Response.json({ error: 6, message: "Track not found" });
  }) as typeof fetch;

  const result = await fetchDetailedScrobbles({
    apiKey: "key",
    username: "lance",
    artist: "The Japanese House",
    track: "i saw you in a dream",
    fetcher
  });

  assert.deepEqual(result, { artistScrobbles: 108, trackScrobbles: null });
});

test("marks the most recent scrobble as not currently playing", () => {
  const result = normalizeRecentTracks({
    recenttracks: {
      track: [{
        name: "Last song",
        artist: { "#text": "An artist" },
        album: { "#text": "An album" },
        image: [],
        date: { uts: "1786492800" }
      }]
    }
  }, "lance");

  assert.equal(result.isPlaying, false);
  assert.equal(result.track?.name, "Last song");
  assert.ok(result.track?.playedAt);
});

test("escapes user-controlled metadata in the SVG card", () => {
  const svg = renderNowPlayingSvg({
    isPlaying: true,
    username: "lance",
    scrobbles: 1,
    artistScrobbles: null,
    trackScrobbles: null,
    artistImageUrl: "",
    artistImageSourceUrl: "",
    updatedAt: new Date().toISOString(),
    track: {
      name: "<script>alert(1)</script>",
      artist: "A & B",
      album: "",
      url: "",
      imageUrl: "",
      imageSourceUrl: "",
      playedAt: null
    }
  });

  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /A &amp; B/);
});

test("formats now-playing and relative card statuses", () => {
  const now = new Date("2026-08-12T01:00:00.000Z");
  const data = normalizeRecentTracks({
    recenttracks: {
      track: [{
        name: "Last song",
        artist: { "#text": "An artist" },
        date: { uts: String(new Date("2026-08-12T00:52:00.000Z").getTime() / 1000) }
      }]
    }
  }, "lance", now);

  assert.equal(formatListeningStatus(data, now), "8 minutes ago");
  assert.equal(formatListeningStatus({ ...data, isPlaying: true }, now), "now playing");
});

test("embeds supplied cover and background artwork in the SVG card", () => {
  const artwork = "data:image/png;base64,YXJ0";
  const data = normalizeRecentTracks({
    recenttracks: {
      track: [{ name: "A song", artist: { "#text": "An artist" } }]
    }
  }, "lance");
  const svg = renderNowPlayingSvg(data, { cover: artwork, background: artwork });

  assert.equal(svg.match(/data:image\/png;base64,YXJ0/g)?.length, 2);
  assert.match(svg, /feGaussianBlur/);
});

test("uses a display name in the SVG card without changing the tracked account", () => {
  const data = normalizeRecentTracks({
    recenttracks: {
      track: [{
        name: "A song",
        artist: { "#text": "An artist" },
        "@attr": { nowplaying: "true" }
      }]
    }
  }, "xMdb");
  const svg = renderNowPlayingSvg(data, { displayName: "Orpheus" });

  assert.match(svg, /Orpheus is listening/);
  assert.equal(data.username, "xMdb");
});

test("normalizes OpenWeatherMap current conditions", () => {
  assert.deepEqual(normalizeOpenWeatherMap({
    weather: [{ description: "broken clouds", icon: "04d" }],
    main: { temp: 26.4, feels_like: 28.1 }
  }), {
    label: "Broken clouds",
    symbol: "☁",
    icon: "04d",
    temperature: 26.4,
    apparentTemperature: 28.1,
    unit: "°C"
  });
  assert.equal(weatherSymbol("11n"), "ϟ");
  assert.equal(weatherIconClass("04d"), "wi wi-cloudy");
});
