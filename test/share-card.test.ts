import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createShareCardResponse } from "../api/share-card";
import { parseShareImagePreferences, shareImageUrl } from "../src/share-link";
import { defaultSharePreferences, type SharePreferences } from "../src/share-preferences";

test("share links round-trip card options and omit a hidden display name", () => {
  const preferences: SharePreferences = {
    ...defaultSharePreferences,
    format: "story",
    background: "gradient",
    backgroundColor: "#a49fcd",
    blur: false,
    color: "neutral",
    show: { ...defaultSharePreferences.show, displayName: false, albumPlays: false }
  };
  const url = new URL(shareImageUrl("https://listening.example", { username: "one&two", displayName: "Private label" }, preferences));
  assert.equal(url.pathname, "/share.png");
  assert.equal(url.searchParams.get("user"), "one&two");
  assert.equal(url.searchParams.has("name"), false);
  assert.deepEqual(parseShareImagePreferences(url.searchParams), preferences);
});

test("renders a PNG from the current track and URL settings", async (t) => {
  const previous = new Map(Object.entries(process.env));
  process.env.LASTFM_API_KEY = "test-key";
  process.env.LASTFM_USERNAME = "share-link-user";
  process.env.ALLOW_CUSTOM_LASTFM_USERS = "false";
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  t.after(() => {
    for (const key of ["LASTFM_API_KEY", "LASTFM_USERNAME", "ALLOW_CUSTOM_LASTFM_USERS", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"]) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const cover = createCanvas(20, 20);
  const context = cover.getContext("2d");
  context.fillStyle = "#ce382e";
  context.fillRect(0, 0, 20, 20);
  const bytes = new Uint8Array(cover.toBuffer("image/png"));
  const upstream = t.mock.method(globalThis, "fetch", async (source: string | URL) => {
    const url = new URL(source);
    if (url.hostname === "i.scdn.co") return new Response(bytes, { headers: { "Content-Type": "image/png" } });
    switch (url.searchParams.get("method")) {
      case "user.getrecenttracks": return Response.json({ recenttracks: { track: [{
        name: "Current song", artist: { "#text": "Artist" }, album: { "#text": "Album" },
        image: [{ "#text": "https://i.scdn.co/image/1234abcd" }], "@attr": { nowplaying: "true" }
      }] } });
      case "artist.getInfo": return Response.json({ artist: { stats: { userplaycount: "2" } } });
      case "track.getInfo": return Response.json({ track: { userplaycount: "1", userloved: "0" } });
      default: assert.fail(`Unexpected upstream method: ${url.searchParams.get("method")}`);
    }
  });

  const origin = "https://listening.example/share.png";
  assert.equal((await createShareCardResponse(new Request(`${origin}?format=wide`))).status, 400);
  assert.equal((await createShareCardResponse(new Request(`${origin}?format=story&format=square`))).status, 400);
  assert.equal((await createShareCardResponse(new Request(`${origin}?user=other-user`))).status, 403);
  assert.equal(upstream.mock.callCount(), 0);

  const url = `${origin}?user=share-link-user&format=story&background=solid&bgColor=123456&hide=albumPlays`;
  const response = await createShareCardResponse(new Request(url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  const image = await loadImage(new Uint8Array(await response.arrayBuffer()));
  assert.deepEqual([image.width, image.height], [1080, 1920]);
  const sample = createCanvas(1, 1).getContext("2d");
  sample.drawImage(image, 0, 0);
  assert.deepEqual([...sample.getImageData(0, 0, 1, 1).data], [0x12, 0x34, 0x56, 255]);
  assert.equal((await createShareCardResponse(new Request(url, { method: "HEAD" }))).body, null);
});
