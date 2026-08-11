import { useEffect, useMemo, useState } from "react";
import { useArtworkColors } from "./hooks/useArtworkColors";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useWeather } from "./hooks/useWeather";
import { weatherIconClass } from "./weather";

interface Features {
  weather: boolean;
  time: boolean;
  extended: boolean;
}

type Feature = keyof Features;

const defaultFeatures: Features = {
  weather: false,
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

export default function App(): React.JSX.Element {
  const { data, error, loading } = useNowPlaying();
  const [features, setFeatures] = useState(loadFeatures);
  const [helpVisible, setHelpVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const weather = useWeather(features.weather);
  const track = data?.track ?? null;
  const colors = useArtworkColors(track?.imageUrl);

  const displayStyle = useMemo<React.CSSProperties>(() => ({
    "--cover-url": track?.imageUrl ? `url("${track.imageUrl.replaceAll('"', "%22")}")` : "none",
    "--title-color": colors[0],
    "--artist-color": colors[1]
  }) as React.CSSProperties, [colors, track?.imageUrl]);

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
    <div className={`listening ${cursorHidden ? "cursor-hidden" : ""}`} style={displayStyle}>
      <div className="background blur" aria-hidden="true" />

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
          <div className="corner left">
            <nav className={`help code fade ${helpVisible ? "visible" : "hidden"}`} aria-label="Display controls" aria-hidden={!helpVisible}>
              <div className="links">
                <a href="https://github.com/xmdbro/listening" target="_blank" rel="noreferrer" tabIndex={helpVisible ? 0 : -1}>
                  source <i className="fa-brands fa-github" aria-hidden="true" />
                </a>
              </div>
              <button type="button" tabIndex={helpVisible ? 0 : -1} aria-pressed={features.weather} onClick={() => toggle("weather")}>
                <i className="fa-solid fa-sun fa-fw" aria-hidden="true" /> [w]eather
              </button>
              <button type="button" tabIndex={helpVisible ? 0 : -1} aria-pressed={features.time} onClick={() => toggle("time")}>
                <i className="fa-solid fa-clock fa-fw" aria-hidden="true" /> [t]ime and date
              </button>
              <button type="button" tabIndex={helpVisible ? 0 : -1} aria-pressed={features.extended} onClick={() => toggle("extended")}>
                <i className="fa-solid fa-note-sticky fa-fw" aria-hidden="true" /> [e]xtended info
              </button>
              <button type="button" tabIndex={helpVisible ? 0 : -1} onClick={() => setHelpVisible(false)}>
                <i className="fa-solid fa-question fa-fw" aria-hidden="true" /> [h]elp
              </button>
            </nav>
          </div>

          <div className="corner right music" aria-live="polite">
            {loading && <p className="loading-message">Checking Last.fm...</p>}
            {error && <p className="error-message">{error}</p>}

            {track && (
              <>
                <div className={`user-line fade ${features.extended ? "visible" : "hidden"}`} aria-hidden={!features.extended}>
                  {data?.scrobbles !== null && (
                    <p className="scrobbles"><b>{formatScrobbles(data?.scrobbles ?? null)}</b> scrobbles</p>
                  )}
                  <h2>
                    <i className="fa-brands fa-lastfm" aria-hidden="true" />{" "}
                    {data?.username} {data?.isPlaying ? "is listening to" : "last listened to"}
                  </h2>
                </div>

                <a className="song-link" href={track.url || undefined} target="_blank" rel="noreferrer">
                  {track.imageUrl ? (
                    <img className="cover" src={track.imageUrl} alt={track.album ? `Cover art for ${track.album}` : "Album cover"} />
                  ) : (
                    <div className="cover cover-placeholder" aria-label="No album cover available">♪</div>
                  )}
                </a>
                <h1 className="title">{track.name}</h1>
                <h2 className="artist">{track.artist}</h2>
              </>
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
