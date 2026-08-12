import assert from "node:assert/strict";
import test from "node:test";
import { fetchImageDataUrl } from "../src/image-data";

test("embeds trusted Spotify artwork as a data URL", async () => {
  const fetcher = (async () => new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "image/jpeg" }
  })) as typeof fetch;

  assert.equal(
    await fetchImageDataUrl("https://i.scdn.co/image/example", fetcher),
    "data:image/jpeg;base64,AQID"
  );
});

test("rejects untrusted artwork hosts", async () => {
  let requested = false;
  const fetcher = (async () => {
    requested = true;
    return new Response();
  }) as typeof fetch;

  assert.equal(await fetchImageDataUrl("https://example.com/image.jpg", fetcher), "");
  assert.equal(requested, false);
});

test("rejects unsafe or oversized image responses", async () => {
  const svgFetcher = (async () => new Response("<svg />", {
    headers: { "content-type": "image/svg+xml" }
  })) as typeof fetch;
  const oversizedFetcher = (async () => new Response(new Uint8Array([1]), {
    headers: {
      "content-length": String(5 * 1024 * 1024 + 1),
      "content-type": "image/jpeg"
    }
  })) as typeof fetch;

  assert.equal(
    await fetchImageDataUrl("https://i.scdn.co/image/example", svgFetcher),
    ""
  );
  assert.equal(
    await fetchImageDataUrl("https://i.scdn.co/image/example", oversizedFetcher),
    ""
  );
});
