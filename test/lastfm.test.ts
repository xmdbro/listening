import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecentTracks } from "../src/lastfm";
import { renderNowPlayingSvg } from "../src/svg";
import { normalizeOpenWeatherMap, weatherSymbol } from "../src/weather";

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
  assert.equal(result.track?.name, "Cattails");
  assert.equal(result.track?.artist, "Big Thief");
  assert.equal(result.track?.imageUrl, "https://example.com/cover.jpg");
  assert.equal(result.updatedAt, now.toISOString());
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
    updatedAt: new Date().toISOString(),
    track: {
      name: "<script>alert(1)</script>",
      artist: "A & B",
      album: "",
      url: "",
      imageUrl: "",
      playedAt: null
    }
  });

  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /A &amp; B/);
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
});
