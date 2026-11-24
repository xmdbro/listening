import assert from "node:assert/strict";
import test from "node:test";
import { createShareArtworkResponse } from "../api/share-artwork";

function requestArtwork(source: string): Request {
  return new Request(`https://listening.example/api/share-artwork?${new URLSearchParams({ src: source })}`);
}

test("serves raster cover art from Spotify and Last.fm without following redirects", async (t) => {
  const sources = [
    "https://i.scdn.co/image/ab67616d0000b2730123456789abcdef",
    "https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef.png"
  ];
  const bytes = new Uint8Array([1, 2, 3]);
  const upstream = t.mock.method(globalThis, "fetch", async (source: string, options: RequestInit) => {
    assert.ok(sources.includes(source));
    assert.equal(options.redirect, "error");
    return new Response(bytes, { headers: { "Content-Type": "image/png" } });
  });

  for (const source of sources) {
    const response = await createShareArtworkResponse(requestArtwork(source));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  }
  assert.equal(upstream.mock.callCount(), 2);
});

test("rejects untrusted artwork sources and other provider routes before fetching", async (t) => {
  const upstream = t.mock.method(globalThis, "fetch", async () => new Response());
  for (const source of [
    "https://example.com/image/abc",
    "http://i.scdn.co/image/abc",
    "https://i.scdn.co:8080/image/abc",
    "https://i.scdn.co/other/abc",
    "https://i.scdn.co/image/abc?next=example.com",
    "https://lastfm.freetls.fastly.net/i/u/300x300/abc.svg"
  ]) {
    assert.equal((await createShareArtworkResponse(requestArtwork(source))).status, 400);
  }
  assert.equal(upstream.mock.callCount(), 0);
});
