import { useEffect, useMemo, useState } from "react";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useWeather } from "./hooks/useWeather";

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

function TimePanel(): React.JSX.Element {
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
    <section className="corner-panel time-panel" aria-label="Current date and time">
      <p>{date}</p>
      <strong>{time}</strong>
    </section>
  );
}

export default function App(): React.JSX.Element {
  const { data, error, loading } = useNowPlaying();
  const [features, setFeatures] = useState(loadFeatures);
  const weather = useWeather(features.weather);
  const track = data?.track ?? null;

  const backgroundStyle = useMemo<React.CSSProperties>(() => ({
    "--cover-url": track?.imageUrl ? `url("${track.imageUrl.replaceAll('"', "%22")}")` : "none"
  }) as React.CSSProperties, [track?.imageUrl]);

  function toggle(feature: Feature): void {
    setFeatures((current) => {
      const next = { ...current, [feature]: !current[feature] };
      localStorage.setItem("listening:features", JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;

      const featureByKey: Record<string, Feature | undefined> = {
        w: "weather",
        t: "time",
        e: "extended"
      };
      const feature = featureByKey[event.key.toLowerCase()];
      if (feature) {
        event.preventDefault();
        toggle(feature);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (track) document.title = `${track.name} - ${track.artist}`;
  }, [track]);

  return (
    <div className="listening" style={backgroundStyle}>
      <div className="cover-background" aria-hidden="true" />
      <div className="veil" aria-hidden="true" />

      {features.time && <TimePanel />}

      {features.weather && (
        <section className="corner-panel weather-panel" aria-live="polite">
          {weather.loading && <p>Finding local weather...</p>}
          {weather.error && <p>{weather.error}</p>}
          {weather.data && (
            <>
              <p>{weather.data.label} currently</p>
              <strong>
                <span aria-hidden="true">{weather.data.symbol}</span>{" "}
                {Math.round(weather.data.temperature)}{weather.data.unit}
                <small>Feels like {Math.round(weather.data.apparentTemperature)}{weather.data.unit}</small>
              </strong>
            </>
          )}
        </section>
      )}

      <section className="track-panel" aria-live="polite">
        {loading && <p className="loading-message">Checking Last.fm...</p>}
        {error && <p className="error-message">{error}</p>}

        {track && (
          <>
            {features.extended && (
              <div className="extended-info">
                {data?.scrobbles !== null && (
                  <p><strong>{formatScrobbles(data?.scrobbles ?? null)}</strong> scrobbles</p>
                )}
                <p><span>last.fm</span> {data?.username} is listening to</p>
              </div>
            )}

            <a className="cover-link" href={track.url || undefined} target="_blank" rel="noreferrer">
              {track.imageUrl ? (
                <img src={track.imageUrl} alt={track.album ? `Cover art for ${track.album}` : "Album cover"} />
              ) : (
                <div className="cover-placeholder" aria-label="No album cover available">♪</div>
              )}
            </a>
            <h1>{track.name}</h1>
            <p className="artist">{track.artist}</p>
          </>
        )}

        {!loading && !error && !track && (
          <div className="idle-message">
            <h1>Nothing playing</h1>
            <p>Waiting for the next scrobble.</p>
          </div>
        )}
      </section>

      <nav className="controls" aria-label="Display controls">
        <button type="button" aria-pressed={features.weather} onClick={() => toggle("weather")}>
          <kbd>w</kbd> weather
        </button>
        <button type="button" aria-pressed={features.time} onClick={() => toggle("time")}>
          <kbd>t</kbd> time
        </button>
        <button type="button" aria-pressed={features.extended} onClick={() => toggle("extended")}>
          <kbd>e</kbd> extended
        </button>
        {features.weather && (
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a>
        )}
      </nav>
    </div>
  );
}

