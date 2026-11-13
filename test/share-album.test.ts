import assert from "node:assert/strict";
import test from "node:test";
import { createShareAlbumResponse } from "../api/share-album";

function requestAlbum(user: string, album = "A & B"): Request {
  const query = new URLSearchParams({ user, artist: "An artist", album });
  return new Request(`https://listening.example/api/share-album?${query}`);
}

test("returns personal album scrobbles and caches them per account and album", async (t) => {
  const previousKey = process.env.LASTFM_API_KEY;
  const previousUser = process.env.LASTFM_USERNAME;
  const previousPolicy = process.env.ALLOW_CUSTOM_LASTFM_USERS;
  process.env.LASTFM_API_KEY = "test-key";
  process.env.LASTFM_USERNAME = "share-user-one";
  process.env.ALLOW_CUSTOM_LASTFM_USERS = "true";
  t.after(() => {
    if (previousKey === undefined) delete process.env.LASTFM_API_KEY;
    else process.env.LASTFM_API_KEY = previousKey;
    if (previousUser === undefined) delete process.env.LASTFM_USERNAME;
    else process.env.LASTFM_USERNAME = previousUser;
    if (previousPolicy === undefined) delete process.env.ALLOW_CUSTOM_LASTFM_USERS;
    else process.env.ALLOW_CUSTOM_LASTFM_USERS = previousPolicy;
  });

  const upstream = t.mock.method(globalThis, "fetch", async (input: URL) => {
    assert.equal(input.searchParams.get("method"), "album.getInfo");
    assert.equal(input.searchParams.get("artist"), "An artist");
    const user = input.searchParams.get("username");
    assert.ok(user === "share-user-one" || user === "share-user-two");
    const album = input.searchParams.get("album");
    assert.ok(album === "A & B" || album === "Uncounted album");
    const userplaycount = album === "Uncounted album" ? null : user === "share-user-one" ? "0" : "12";
    return Response.json({ album: { userplaycount, playcount: "400000" } });
  });

  const request = requestAlbum("share-user-one");
  const [one, duplicate, two, uncounted] = await Promise.all([
    createShareAlbumResponse(request),
    createShareAlbumResponse(request),
    createShareAlbumResponse(requestAlbum("share-user-two")),
    createShareAlbumResponse(requestAlbum("share-user-one", "Uncounted album"))
  ]);
  assert.deepEqual(await one.json(), { albumScrobbles: 0 });
  assert.deepEqual(await duplicate.json(), { albumScrobbles: 0 });
  assert.deepEqual(await two.json(), { albumScrobbles: 12 });
  assert.deepEqual(await uncounted.json(), { albumScrobbles: null });
  assert.deepEqual(await (await createShareAlbumResponse(request)).json(), { albumScrobbles: 0 });

  process.env.ALLOW_CUSTOM_LASTFM_USERS = "false";
  assert.equal((await createShareAlbumResponse(requestAlbum("share-user-two"))).status, 403);
  assert.equal((await createShareAlbumResponse(requestAlbum("share-user-one", ""))).status, 400);
  assert.equal(upstream.mock.callCount(), 3);
});
