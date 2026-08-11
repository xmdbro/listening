import assert from "node:assert/strict";
import test from "node:test";
import { fetchSpotifyArtwork } from "../src/spotify";

test("loads Spotify album and artist artwork", async () => {
  const requests: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);

    if (url.includes("accounts.spotify.com")) {
      assert.equal(init?.method, "POST");
      assert.match(String((init?.headers as Record<string, string>).Authorization), /^Basic /);
      return Response.json({ access_token: "token", expires_in: 3600 });
    }

    if (url.includes("/search?")) {
      const searchUrl = new URL(url);
      assert.equal(searchUrl.searchParams.get("type"), "track");
      assert.equal(searchUrl.searchParams.get("limit"), "1");
      return Response.json({
        tracks: {
          items: [{
            name: "Cattails",
            external_urls: { spotify: "https://open.spotify.com/track/track-id" },
            album: {
              images: [{ url: "https://i.scdn.co/album.jpg" }],
              external_urls: { spotify: "https://open.spotify.com/album/album-id" }
            },
            artists: [{
              id: "artist-id",
              name: "Big Thief",
              external_urls: { spotify: "https://open.spotify.com/artist/artist-id" }
            }]
          }]
        }
      });
    }

    return Response.json({
      images: [{ url: "https://i.scdn.co/artist.jpg" }],
      external_urls: { spotify: "https://open.spotify.com/artist/artist-id" }
    });
  }) as typeof fetch;

  const artwork = await fetchSpotifyArtwork({
    clientId: "client",
    clientSecret: "secret",
    artist: "Big Thief",
    track: "Cattails",
    fetcher
  });

  assert.deepEqual(artwork, {
    albumImageUrl: "https://i.scdn.co/album.jpg",
    albumUrl: "https://open.spotify.com/album/album-id",
    artistImageUrl: "https://i.scdn.co/artist.jpg",
    artistUrl: "https://open.spotify.com/artist/artist-id"
  });
  assert.equal(requests.length, 3);
});
