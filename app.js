const elements = {
  album: document.querySelector("#album"),
  artist: document.querySelector("#artist"),
  link: document.querySelector("#track-link"),
  status: document.querySelector("#status"),
  timestamp: document.querySelector("#timestamp"),
  title: document.querySelector("#title")
};

const refreshEvery = 15_000;

function displayTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function updatePage(data) {
  const track = data.track;
  elements.status.textContent = data.isPlaying ? "Now playing" : "Last played";
  elements.timestamp.textContent = `Updated ${displayTime(new Date(data.updatedAt))}`;

  if (!track) {
    elements.title.textContent = "Nothing playing right now";
    elements.artist.textContent = `@${data.username}`;
    elements.album.textContent = "";
    elements.link.hidden = true;
    return;
  }

  elements.title.textContent = track.name || "Untitled";
  elements.artist.textContent = track.artist || "Unknown artist";
  elements.album.textContent = track.album || "";
  elements.link.href = track.url;
  elements.link.hidden = !track.url;
  document.title = `${track.name} - ${track.artist}`;
}

function showError(error) {
  elements.status.textContent = "Unavailable";
  elements.title.textContent = "Listening is not configured";
  elements.artist.textContent = error.message;
  elements.album.textContent = "Check the setup notes, then refresh.";
  elements.link.hidden = true;
  elements.timestamp.textContent = "Could not reach listening data";
}

async function refresh() {
  try {
    const response = await fetch("/api/now-playing", {
      signal: AbortSignal.timeout(6_000)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error || "Listening data is unavailable.");
    }

    updatePage(data);
  } catch (error) {
    showError(error);
  }
}

refresh();
setInterval(() => {
  if (!document.hidden) refresh();
}, refreshEvery);

