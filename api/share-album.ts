import { getAlbumScrobbles } from "../src/lastfm.js";
import { resolveLastFmUsername } from "../src/lastfm-user.js";

export async function createShareAlbumResponse(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  let username: string | undefined;
  try {
    username = resolveLastFmUsername(request, process.env, ["user", "artist", "album"]);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    return new Response(null, { status: code === "CUSTOM_USERS_DISABLED" ? 403 : 400 });
  }

  const parameters = new URL(request.url).searchParams;
  const artist = parameters.get("artist")?.trim();
  const album = parameters.get("album")?.trim();
  if (!username || !artist || !album || artist.length > 512 || album.length > 512 || /\u0000/u.test(artist + album)) {
    return new Response(null, { status: 400 });
  }

  const albumScrobbles = await getAlbumScrobbles(username, artist, album);
  return Response.json({ albumScrobbles });
}

export default { fetch: createShareAlbumResponse };
