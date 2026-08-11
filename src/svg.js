function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value, length) {
  const string = String(value ?? "");
  return string.length > length ? `${string.slice(0, length - 3)}...` : string;
}

export function renderNowPlayingSvg(data) {
  const hasTrack = Boolean(data?.track);
  const title = hasTrack ? truncate(data.track.name, 42) : "Nothing playing right now";
  const artist = hasTrack
    ? truncate(data.track.artist, 48)
    : `last.fm/user/${data?.username || "unknown"}`;
  const status = data?.isPlaying ? "NOW PLAYING" : "LAST PLAYED";
  const statusColor = data?.isPlaying ? "#55d187" : "#8b8b96";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="100" viewBox="0 0 480 100" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(status)}: ${escapeXml(title)}</title>
  <desc id="description">${escapeXml(artist)}</desc>
  <rect x="0.5" y="0.5" width="479" height="99" rx="8" fill="#111111" stroke="#333333" />
  <circle cx="25" cy="25" r="4" fill="${statusColor}" />
  <text x="38" y="29" fill="#aaaaaa" font-family="system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="1">${escapeXml(status)}</text>
  <text x="20" y="59" fill="#f4f4f4" font-family="system-ui, sans-serif" font-size="18" font-weight="600">${escapeXml(title)}</text>
  <text x="20" y="82" fill="#aaaaaa" font-family="system-ui, sans-serif" font-size="14">${escapeXml(artist)}</text>
</svg>`;
}
