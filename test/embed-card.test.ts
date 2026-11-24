import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createCardResponse } from "../api/card";
import { defaultEmbedOptions, embedCardUrl, embedSnippet, embedWidths, parseEmbedOptions, type EmbedOptions } from "../src/embed-card";
import { renderNowPlayingSvg } from "../src/svg";
import type { NowPlayingData } from "../src/types";

const track = {
  name: "Let Down", artist: "Radiohead", album: "OK Computer",
  url: "", imageUrl: "", imageSourceUrl: "", playedAt: null
};
const playback: NowPlayingData = {
  username: "listener", isPlaying: true, scrobbles: 113269, artistScrobbles: null,
  trackScrobbles: 0, trackLoved: null, artistImageUrl: "", artistImageSourceUrl: "",
  track, updatedAt: "2026-11-24T00:00:00Z"
};
const customised: EmbedOptions = {
  ...defaultEmbedOptions,
  width: 550,
  backgroundColor: "#ececec",
  titleColor: "#315273",
  show: { ...defaultEmbedOptions.show, cover: false, name: false, status: false, total: false, plays: true }
};

test("SVG output for existing embeds matches the original renderer", () => {
  // These hashes come from the renderer on main at 0a59c16.
  const cover = "data:image/png;base64,Y292ZXI=";
  const now = new Date("2026-11-24T02:15:00Z");
  const cases = [
    {
      name: "now playing with artwork and a display name",
      data: playback,
      images: { cover, background: "data:image/png;base64,YmFja2dyb3VuZA==", displayName: "Lance & Co" },
      hash: "f93a0850278791b0aedb3cd08ce036153e83b7503bb8dda4f764e2ca477a2bd7"
    },
    {
      name: "recent track with long Unicode metadata and a zero count",
      data: {
        ...playback, isPlaying: false, scrobbles: 0,
        track: { ...track, name: "🎧".repeat(20) + " last track", artist: "名".repeat(50), album: "A very long & memorable album title ".repeat(2) }
      },
      images: { cover },
      hash: "35dbefd69b72c78d6cdc6ab9f9461767ebd0c1987e873826e00b92162d02ffe1"
    },
    {
      name: "idle with missing artwork and scrobbles",
      data: { ...playback, isPlaying: false, track: null, scrobbles: null },
      images: {},
      hash: "cf60f37aee2cc96e6c9778760631d5f9ecf60d1d64fb79728f1ae8cd41b03504"
    }
  ];
  for (const { name, data, images, hash } of cases) {
    assert.equal(createHash("sha256").update(renderNowPlayingSvg(data, images, now)).digest("hex"), hash, name);
  }
});

test("embed links round-trip settings and use the same URL in both snippet formats", () => {
  const url = new URL(embedCardUrl("https://listening.example", "one&two", "Private label", customised));
  assert.equal(url.pathname, "/now.svg");
  assert.equal(url.searchParams.get("user"), "one&two");
  assert.equal(url.searchParams.has("name"), false);
  assert.deepEqual(parseEmbedOptions(url.searchParams), customised);
  assert.match(embedSnippet(url.href, "HTML", customised), /user=one%26two&amp;width=550/);
  assert.match(embedSnippet(url.href, "HTML", customised), /width="550" height="145"/);
  assert.equal(embedSnippet(url.href, "Markdown", customised), `![Live Last.fm listening card](<${url.href}>)`);
});

test("the original card and custom-width card render the expected fields", () => {
  const original = renderNowPlayingSvg(playback, { displayName: "Lance & Co" });
  assert.match(original, /width="620" height="164" viewBox="0 0 620 164"/);
  assert.match(original, /x="166" y="77" fill="#f7f7f7"[^>]*font-size="24"[^>]*>Let Down/);
  assert.match(original, /Lance &amp; Co is listening/);
  assert.match(original, /113,269 scrobbles/);
  assert.doesNotMatch(original, /track plays/);

  const card = renderNowPlayingSvg(playback, { displayName: "Private label", cover: "cover-data", background: "background-data" }, undefined, customised);
  assert.match(card, /width="550" height="145" viewBox="0 0 620 164"/);
  assert.match(card, /fill="#ececec"/);
  assert.match(card, /fill="#315273"[^>]*font-size="24"[^>]*>Let Down/);
  assert.match(card, /0 track plays/);
  assert.doesNotMatch(card, /Private label|now playing|113,269|cover-data|background-data/);
  assert.doesNotMatch(renderNowPlayingSvg({ ...playback, trackScrobbles: null }, {}, undefined, customised), /track plays/);
});

test("compact Markdown carries its size in the image URL", () => {
  const options = { ...defaultEmbedOptions, width: embedWidths.compact };
  const url = embedCardUrl("https://listening.example", "listener", "", options);
  assert.equal(new URL(url).searchParams.get("size"), "compact");
  assert.equal(embedSnippet(url, "Markdown", options), `![Live Last.fm listening card](<${url}>)`);
  assert.match(renderNowPlayingSvg(playback, {}, undefined, options), /width="480" height="127" viewBox="0 0 620 164"/);
});

test("the SVG endpoint validates options and retains the existing account restrictions", async (t) => {
  const previous = { ...process.env };
  process.env.LASTFM_API_KEY = "test-key";
  process.env.LASTFM_USERNAME = "embed-test-user";
  process.env.ALLOW_CUSTOM_LASTFM_USERS = "false";
  process.env.NODE_ENV = "production";
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  t.after(() => {
    for (const key of ["LASTFM_API_KEY", "LASTFM_USERNAME", "ALLOW_CUSTOM_LASTFM_USERS", "NODE_ENV", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  const upstream = t.mock.method(globalThis, "fetch", async (source: string | URL) => {
    switch (new URL(source).searchParams.get("method")) {
      case "user.getrecenttracks":
        return Response.json({ recenttracks: { track: [{
          name: track.name, artist: { "#text": track.artist }, album: { "#text": track.album }, "@attr": { nowplaying: "true" }
        }] } });
      case "artist.getInfo": return Response.json({ artist: { stats: { userplaycount: "2" } } });
      case "track.getInfo": return Response.json({ track: { userplaycount: "0", userloved: "0" } });
      default: assert.fail("Unexpected upstream request");
    }
  });

  const origin = "https://listening.example/now.svg";
  for (const query of [
    "layout=stacked", "size=large", "size=compact&width=550", "width=0", "width=4097", "width=5e2",
    "width=12.5", "width=", "width=480&width=550", "bg=%23ffffff", "accent=red", "show-status=false",
    "size=standard&size=compact", "unknown=1"
  ]) {
    assert.equal((await createCardResponse(new Request(`${origin}?${query}`))).status, 400, query);
  }
  assert.equal((await createCardResponse(new Request(`${origin}?user=other-user&width=550`))).status, 403);
  const forbidden = await createCardResponse(new Request(`${origin}?user=other-user`));
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("Cache-Control"), "no-store");
  assert.equal(upstream.mock.callCount(), 0);

  const legacyData = { ...playback, username: "embed-test-user", scrobbles: null };
  for (const path of ["/now.svg", "/api/card"]) {
    for (const [query, displayName] of [
      ["", ""], ["?user=embed-test-user", ""], ["?name=Lance", "Lance"], ["?user=embed-test-user&name=Lance", "Lance"]
    ]) {
      const original = await createCardResponse(new Request(`https://listening.example${path}${query}`));
      assert.equal(original.status, 200);
      assert.equal(original.headers.get("Content-Type"), "image/svg+xml; charset=utf-8");
      assert.equal(original.headers.get("Cache-Control"), "public, max-age=60, s-maxage=15, stale-while-revalidate=45");
      assert.equal(await original.text(), renderNowPlayingSvg(legacyData, { displayName }), path + query);
    }
  }

  const response = await createCardResponse(new Request(`${origin}?width=550&show-plays=1&show-cover=0`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/svg+xml; charset=utf-8");
  const card = await response.text();
  assert.match(card, /width="550" height="145" viewBox="0 0 620 164"/);
  assert.match(card, /0 track plays/);
  assert.doesNotMatch(card, /&#9835;/);
});
