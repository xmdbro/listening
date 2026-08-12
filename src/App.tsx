import { useEffect, useMemo, useState } from "react";
import { useArtworkColors } from "./hooks/useArtworkColors";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useTrackTransition } from "./hooks/useTrackTransition";
import { useWeather } from "./hooks/useWeather";
import type { NowPlayingData } from "./types";
import { weatherIconClass } from "./weather";

interface Features {
  weather: boolean;
  time: boolean;
  extended: boolean;
}

type Feature = keyof Features;

const defaultFeatures: Features = {
  weather: true,
  time: true,
  extended: true
};

function loadFeatures(): Features {
  try {
    const saved = localStorage.getItem("listening:features");
    return saved ? { ...defaultFeatures, ...JSON.parse(saved) as Partial<Features> } : defaultFeatures;
  } catch {
    return defaultFeatures;
  }
}

function formatScrobbles(value: number | null): string {
  return value === null ? "" : new Intl.NumberFormat().format(value);
}

function TimePanel({ visible }: { visible: boolean }): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const date = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(now);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);

  return (
    <section className={`datetime fade ${visible ? "visible" : "hidden"}`} aria-hidden={!visible}>
      <h2>{date}</h2>
      <h1>{time}</h1>
    </section>
  );
}

function backgroundStyle(data: NowPlayingData | null): React.CSSProperties {
  const url = data?.artistImageUrl || data?.track?.imageUrl;
  return {
    "--cover-url": url ? `url("${url.replaceAll('"', "%22")}")` : "none"
  } as React.CSSProperties;
}

function MusicPanel({
  data,
  extended,
  phase = "current"
}: {
  data: NowPlayingData;
  extended: boolean;
  phase?: "current" | "incoming" | "outgoing";
}): React.JSX.Element | null {
  const track = data.track;
  if (!track) return null;

  return (
    <div className={`music-panel ${phase}`} aria-hidden={phase === "outgoing" || undefined}>
      <div className={`user-line transition-text fade ${extended ? "visible" : "hidden"}`} aria-hidden={!extended}>
        {data.scrobbles !== null && (
          <p className="scrobbles"><b>{formatScrobbles(data.scrobbles)}</b> scrobbles</p>
        )}
        {data.artistScrobbles !== null && data.trackScrobbles !== null && (
          <p className="detailed-scrobbles">
            <b>{formatScrobbles(data.artistScrobbles)}</b> this artist •{" "}
            <b>{formatScrobbles(data.trackScrobbles)}</b> this track
          </p>
        )}
        <h2>
          <i className="fa-brands fa-lastfm" aria-hidden="true" />{" "}
          {data.username} {data.isPlaying ? "is listening to" : "last listened to"}
        </h2>
      </div>

      <a className="song-link" href={track.imageSourceUrl || track.url || undefined} target="_blank" rel="noreferrer">
        {track.imageUrl ? (
          <img className="cover" src={track.imageUrl} alt={track.album ? `Cover art for ${track.album}` : "Album cover"} />
        ) : (
          <div className="cover cover-placeholder" aria-label="No album cover available">♪</div>
        )}
      </a>
      <div className="song-copy transition-text">
        <h1 className="title">{track.name}</h1>
        <h2 className="artist">{track.artist}</h2>
      </div>
    </div>
  );
}

export default function App(): React.JSX.Element {
  const { data, error, loading } = useNowPlaying();
  const transition = useTrackTransition(data);
  const [features, setFeatures] = useState(loadFeatures);
  const [helpVisible, setHelpVisible] = useState(true);
  const [helpHovered, setHelpHovered] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const weather = useWeather(features.weather);
  const presentedData = transition.current;
  const track = presentedData?.track ?? null;
  const colors = useArtworkColors(track?.imageUrl);
  const controlsVisible = helpVisible || helpHovered;

  const displayStyle = useMemo<React.CSSProperties>(() => ({
    "--title-color": colors[0],
    "--artist-color": colors[1]
  }) as React.CSSProperties, [colors]);

  function toggle(feature: Feature): void {
    setFeatures((current) => {
      const next = { ...current, [feature]: !current[feature] };
      localStorage.setItem("listening:features", JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    const initialFade = window.setTimeout(() => setHelpVisible(false), 3_600);
    return () => window.clearTimeout(initialFade);
  }, []);

  useEffect(() => {
    let timeout = window.setTimeout(() => setCursorHidden(true), 3_000);
    const showCursor = () => {
      setCursorHidden(false);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setCursorHidden(true), 3_000);
    };
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "contextmenu"];
    events.forEach((event) => window.addEventListener(event, showCursor));
    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, showCursor));
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();

      if (key === "h") {
        event.preventDefault();
        setHelpVisible((visible) => !visible);
        return;
      }

      const featureByKey: Record<string, Feature | undefined> = {
        w: "weather",
        t: "time",
        e: "extended"
      };
      const feature = featureByKey[key];
      if (feature) {
        event.preventDefault();
        toggle(feature);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    document.title = track ? `"${track.name}" by ${track.artist}` : "Listening";
  }, [track]);

  return (
    <div className={`listening ${cursorHidden ? "cursor-hidden" : ""} ${transition.transitioning ? "track-transitioning" : ""}`} style={displayStyle}>
      <div className="background-stack" aria-hidden="true">
        {transition.outgoing && (
          <div className="background background-outgoing" style={backgroundStyle(transition.outgoing)} />
        )}
        <div
          key={`${track?.artist ?? "idle"}-${track?.name ?? ""}`}
          className={`background ${transition.transitioning ? "background-incoming" : "background-current"}`}
          style={backgroundStyle(presentedData)}
        />
      </div>

      <main className="container">
        <div className="row top">
          <div className="corner left">
            <TimePanel visible={features.time} />
          </div>

          <div className="corner right">
            <section className={`weather fade ${features.weather ? "visible" : "hidden"}`} aria-live="polite" aria-hidden={!features.weather}>
              {weather.loading && <h2>Finding local weather...</h2>}
              {weather.error && <h2>{weather.error}</h2>}
              {weather.data && (
                <>
                  <h2>{weather.data.label} currently</h2>
                  <h1 className="conditions">
                    <i className={weatherIconClass(weather.data.icon)} aria-hidden="true" />{" "}
                    {Math.round(weather.data.temperature)}°{weather.data.unit.replace("°", "")}{" "}
                    <span className="apparent">
                      Feels like {Math.round(weather.data.apparentTemperature)}°{weather.data.unit.replace("°", "")}
                    </span>
                  </h1>
                </>
              )}
            </section>
          </div>
        </div>

        <div className="row bottom">
          <div
            className="corner left controls-corner"
            onPointerEnter={() => setHelpHovered(true)}
            onPointerLeave={() => setHelpHovered(false)}
          >
            <nav className={`help code fade ${controlsVisible ? "visible" : "hidden"}`} aria-label="Display controls" aria-hidden={!controlsVisible}>
              <div className="links">
                <a href="https://github.com/xmdbro/listening" target="_blank" rel="noreferrer" tabIndex={controlsVisible ? 0 : -1}>
                  source <i className="fa-brands fa-github" aria-hidden="true" />
                </a>
                {presentedData?.artistImageSourceUrl && (
                  <a href={presentedData.artistImageSourceUrl} target="_blank" rel="noreferrer" tabIndex={controlsVisible ? 0 : -1}>
                    artist <i className="fa-brands fa-spotify" aria-hidden="true" />
                  </a>
                )}
              </div>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={features.weather} onClick={() => toggle("weather")}>
                <i className="fa-solid fa-sun fa-fw" aria-hidden="true" /> [w]eather
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={features.time} onClick={() => toggle("time")}>
                <i className="fa-solid fa-clock fa-fw" aria-hidden="true" /> [t]ime and date
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={features.extended} onClick={() => toggle("extended")}>
                <i className="fa-solid fa-note-sticky fa-fw" aria-hidden="true" /> [e]xtended info
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} onClick={() => setHelpVisible(false)}>
                <i className="fa-solid fa-question fa-fw" aria-hidden="true" /> [h]elp
              </button>
            </nav>
          </div>

          <div className="corner right music" aria-live="polite">
            {loading && <p className="loading-message">Checking Last.fm...</p>}
            {error && <p className="error-message">{error}</p>}

            {transition.outgoing && (
              <MusicPanel data={transition.outgoing} extended={features.extended} phase="outgoing" />
            )}
            {presentedData?.track && (
              <MusicPanel
                key={`${track?.artist ?? ""}-${track?.name ?? ""}`}
                data={presentedData}
                extended={features.extended}
                phase={transition.transitioning ? "incoming" : "current"}
              />
            )}

            {!loading && !error && !track && (
              <div className="idle-message">
                <h1>Nothing in the air...</h1>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
