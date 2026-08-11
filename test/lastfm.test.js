import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecentTracks } from "../src/lastfm.js";
import { renderNowPlayingSvg } from "../src/svg.js";

test("normalizes a currently playing Last.fm track", () => {
  const now = new Date("2026-08-12T00:00:00.000Z");
  const result = normalizeRecentTracks({
    recenttracks: {
      track: [{
        name: "Cattails",
        artist: { "#text": "Big Thief" },
        album: { "#text": "U.F.O.F." },
        image: [{ size: "small", "#text": "" }, { size: "large", "#text": "https://example.com/cover.jpg" }],
        url: "https://last.fm/example",
        "@attr": { nowplaying: "true" }
      }]
    }
  }, "lance", now);

  assert.equal(result.isPlaying, true);
  assert.equal(result.track.name, "Cattails");
  assert.equal(result.track.artist, "Big Thief");
  assert.equal(result.track.imageUrl, "https://example.com/cover.jpg");
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
  assert.equal(result.track.name, "Last song");
  assert.ok(result.track.playedAt);
});

test("escapes user-controlled metadata in the SVG card", () => {
  const svg = renderNowPlayingSvg({
    isPlaying: true,
    username: "lance",
    track: { name: "<script>alert(1)</script>", artist: "A & B" }
  });

  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /A &amp; B/);
});

