import { useEffect, useMemo, useState } from "react";
import { SettingsPanel } from "./components/SettingsPanel";
import { useArtworkColors } from "./hooks/useArtworkColors";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useTrackTransition } from "./hooks/useTrackTransition";
import { useWeather } from "./hooks/useWeather";
import {
  customWeatherCoordinates,
  loadPreferences,
  savePreferences,
  type BackgroundType,
  type Feature,
  type Preferences
} from "./preferences";
import { formatListeningStatus } from "./svg";
import type { NowPlayingData } from "./types";
import { weatherIconClass } from "./weather";

function formatScrobbles(value: number | null): string {
  return value === null ? "" : new Intl.NumberFormat().format(value);
}

function TimePanel({
  visible,
  use24HourTime,
  showWeekday,
  showSeconds
}: {
  visible: boolean;
  use24HourTime: boolean;
  showWeekday: boolean;
  showSeconds: boolean;
}): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const date = new Intl.DateTimeFormat(undefined, {
    weekday: showWeekday ? "long" : undefined,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(now);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: !use24HourTime
  }).format(now);

  return (
    <section className={`datetime fade ${visible ? "visible" : "hidden"}`} aria-hidden={!visible}>
      <h2>{date}</h2>
      <h1>{time}</h1>
    </section>
  );
}

function backgroundStyle(data: NowPlayingData | null, type: BackgroundType): React.CSSProperties {
  const url = type === "artist"
    ? data?.artistImageUrl || data?.track?.imageUrl
    : type === "album"
      ? data?.track?.imageUrl || data?.artistImageUrl
      : "";
  return {
    "--cover-url": url ? `url("${url.replaceAll('"', "%22")}")` : "none"
  } as React.CSSProperties;
}

type TrackPhase = "current" | "incoming" | "outgoing";

function ExtendedTrackInfo({
  data,
  displayName,
  extended,
  phase = "current"
}: {
  data: NowPlayingData;
  displayName: string;
  extended: boolean;
  phase?: TrackPhase;
}): React.JSX.Element | null {
  const track = data.track;
  if (!track) return null;

  return (
    <div className={`user-line track-layer ${phase} transition-text fade ${extended ? "visible" : "hidden"}`} aria-hidden={!extended || phase === "outgoing"}>
        {data.scrobbles !== null && (
          <p className="scrobbles"><b>{formatScrobbles(data.scrobbles)}</b> scrobbles</p>
        )}
        {(data.artistScrobbles !== null || data.trackScrobbles !== null) && (
          <p className="detailed-scrobbles">
            {data.artistScrobbles !== null && (
              <><b>{formatScrobbles(data.artistScrobbles)}</b> this artist</>
            )}
            {data.artistScrobbles !== null && data.trackScrobbles !== null && " • "}
            {data.trackScrobbles !== null && (
              <><b>{formatScrobbles(data.trackScrobbles)}</b> this track</>
            )}
          </p>
        )}
        <h2>
          <i className="fa-brands fa-lastfm" aria-hidden="true" />{" "}
          {displayName || data.username} {data.isPlaying ? "is listening to" : "last listened to"}
          {!data.isPlaying && (
            <span className="last-played-status"> · {formatListeningStatus(data)}</span>
          )}
        </h2>
    </div>
  );
}

function CoverArt({ data, phase = "current" }: { data: NowPlayingData; phase?: TrackPhase }): React.JSX.Element | null {
  const track = data.track;
  if (!track) return null;

  return (
    <a
      className={`song-link cover-layer ${phase}`}
      href={track.imageSourceUrl || track.url || undefined}
      target="_blank"
      rel="noreferrer"
      aria-hidden={phase === "outgoing" || undefined}
      tabIndex={phase === "outgoing" ? -1 : undefined}
    >
      {track.imageUrl ? (
        <img className="cover" src={track.imageUrl} alt={track.album ? `Cover art for ${track.album}` : "Album cover"} />
      ) : (
        <div className="cover cover-placeholder" aria-label="No album cover available">♪</div>
      )}
    </a>
  );
}

function TrackCopy({ data, phase = "current" }: { data: NowPlayingData; phase?: TrackPhase }): React.JSX.Element | null {
  const track = data.track;
  if (!track) return null;

  return (
    <div className={`song-copy track-layer ${phase} transition-text`} aria-hidden={phase === "outgoing" || undefined}>
      <h1 className="title">{track.name}</h1>
      <h2 className="artist">{track.artist}</h2>
    </div>
  );
}

function MusicDisplay({
  current,
  outgoing,
  displayName,
  extended,
  transitioning
}: {
  current: NowPlayingData;
  outgoing: NowPlayingData | null;
  displayName: string;
  extended: boolean;
  transitioning: boolean;
}): React.JSX.Element {
  const currentPhase = transitioning ? "incoming" : "current";

  return (
    <div className="music-panel">
      <div className="extended-info-stack">
        {outgoing && <ExtendedTrackInfo data={outgoing} displayName={displayName} extended={extended} phase="outgoing" />}
        <ExtendedTrackInfo data={current} displayName={displayName} extended={extended} phase={currentPhase} />
      </div>
      <div className="cover-stack">
        {outgoing && <CoverArt data={outgoing} phase="outgoing" />}
        <CoverArt data={current} phase={currentPhase} />
      </div>
      <div className="song-copy-stack">
        {outgoing && <TrackCopy data={outgoing} phase="outgoing" />}
        <TrackCopy data={current} phase={currentPhase} />
      </div>
    </div>
  );
}

export default function App(): React.JSX.Element {
  const { data, error, loading } = useNowPlaying();
  const transition = useTrackTransition(data);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(true);
  const [helpHovered, setHelpHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const coordinates = useMemo(
    () => customWeatherCoordinates(preferences),
    [preferences.weatherLatitude, preferences.weatherLongitude]
  );
  const weather = useWeather(preferences.weather, coordinates);
  const presentedData = transition.current;
  const track = presentedData?.track ?? null;
  const colors = useArtworkColors(track?.imageUrl);
  const controlsVisible = helpVisible || helpHovered;

  const displayStyle = useMemo<React.CSSProperties>(() => ({
    "--title-color": colors[0],
    "--artist-color": colors[1]
  }) as React.CSSProperties, [colors]);

  function toggle(feature: Feature): void {
    setPreferences((current) => {
      const next = { ...current, [feature]: !current[feature] };
      savePreferences(next);
      return next;
    });
  }

  function applyPreferences(next: Preferences): void {
    setPreferences(next);
    savePreferences(next);
  }

  function openSettings(): void {
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  }

  useEffect(() => {
    const initialFade = window.setTimeout(() => setHelpVisible(false), 3_600);
    return () => window.clearTimeout(initialFade);
  }, []);

  useEffect(() => {
    let idleTimeout: number | undefined;

    const showMobileMenu = () => {
      setMobileMenuVisible(true);
      if (idleTimeout !== undefined) window.clearTimeout(idleTimeout);
      if (!mobileMenuOpen) {
        idleTimeout = window.setTimeout(() => setMobileMenuVisible(false), 3_600);
      }
    };

    showMobileMenu();
    window.addEventListener("pointerdown", showMobileMenu, { passive: true });
    return () => {
      if (idleTimeout !== undefined) window.clearTimeout(idleTimeout);
      window.removeEventListener("pointerdown", showMobileMenu);
    };
  }, [mobileMenuOpen]);

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

      if (key === "s") {
        event.preventDefault();
        if (!settingsOpen) openSettings();
        return;
      }

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
    <div
      className={`listening background-${preferences.backgroundType} ${preferences.blurBackground ? "background-blurred" : ""} ${cursorHidden && !settingsOpen ? "cursor-hidden" : ""} ${transition.transitioning ? "track-transitioning" : ""}`}
      style={displayStyle}
    >
      <div className="background-stack" aria-hidden="true">
        {transition.outgoing && (
          <div className="background background-outgoing" style={backgroundStyle(transition.outgoing, preferences.backgroundType)} />
        )}
        <div
          key={`${track?.artist ?? "idle"}-${track?.name ?? ""}`}
          className={`background ${transition.transitioning ? "background-incoming" : "background-current"}`}
          style={backgroundStyle(presentedData, preferences.backgroundType)}
        />
      </div>

      <main className="container">
        <div className="row top">
          <div className="corner left">
            <TimePanel
              visible={preferences.time}
              use24HourTime={preferences.use24HourTime}
              showWeekday={preferences.showWeekday}
              showSeconds={preferences.showSeconds}
            />
          </div>

          <div className="corner right">
            <section className={`weather fade ${preferences.weather ? "visible" : "hidden"}`} aria-live="polite" aria-hidden={!preferences.weather}>
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
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={preferences.weather} onClick={() => toggle("weather")}>
                <i className="fa-solid fa-sun fa-fw" aria-hidden="true" /> [w]eather
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={preferences.time} onClick={() => toggle("time")}>
                <i className="fa-solid fa-clock fa-fw" aria-hidden="true" /> [t]ime and date
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} aria-pressed={preferences.extended} onClick={() => toggle("extended")}>
                <i className="fa-solid fa-note-sticky fa-fw" aria-hidden="true" /> [e]xtended info
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} onClick={() => setHelpVisible(false)}>
                <i className="fa-solid fa-question fa-fw" aria-hidden="true" /> [h]elp
              </button>
              <button type="button" tabIndex={controlsVisible ? 0 : -1} onClick={openSettings}>
                <i className="fa-solid fa-sliders fa-fw" aria-hidden="true" /> [s] preferences
              </button>
            </nav>
          </div>

          <div className="corner right music" aria-live="polite">
            {loading && <p className="loading-message">Checking Last.fm...</p>}
            {error && <p className="error-message">{error}</p>}

            {presentedData?.track && (
              <MusicDisplay
                key={`${track?.artist ?? ""}-${track?.name ?? ""}`}
                current={presentedData}
                outgoing={transition.outgoing}
                displayName={preferences.displayName}
                extended={preferences.extended}
                transitioning={transition.transitioning}
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
      <div className={`mobile-menu-shell ${mobileMenuOpen ? "open" : ""} ${mobileMenuVisible ? "awake" : "idle"}`}>
        <nav id="mobile-display-menu" className="mobile-menu-drawer code" aria-label="Display controls" aria-hidden={!mobileMenuOpen}>
          <div className="mobile-menu-links">
            <a href="https://github.com/xmdbro/listening" target="_blank" rel="noreferrer" tabIndex={mobileMenuOpen ? 0 : -1}>
              source <i className="fa-brands fa-github" aria-hidden="true" />
            </a>
            {presentedData?.artistImageSourceUrl && (
              <a href={presentedData.artistImageSourceUrl} target="_blank" rel="noreferrer" tabIndex={mobileMenuOpen ? 0 : -1}>
                artist <i className="fa-brands fa-spotify" aria-hidden="true" />
              </a>
            )}
          </div>
          <button type="button" tabIndex={mobileMenuOpen ? 0 : -1} aria-pressed={preferences.weather} onClick={() => toggle("weather")}>
            [w] weather
          </button>
          <button type="button" tabIndex={mobileMenuOpen ? 0 : -1} aria-pressed={preferences.time} onClick={() => toggle("time")}>
            [t] time and date
          </button>
          <button type="button" tabIndex={mobileMenuOpen ? 0 : -1} aria-pressed={preferences.extended} onClick={() => toggle("extended")}>
            [e] extended info
          </button>
          <button type="button" tabIndex={mobileMenuOpen ? 0 : -1} onClick={openSettings}>
            [s] preferences
          </button>
        </nav>
        <button
          type="button"
          className="mobile-menu-toggle code"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-display-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          [ {mobileMenuOpen ? "close" : "menu"} ]
        </button>
      </div>
      {settingsOpen && (
        <SettingsPanel
          preferences={preferences}
          onCancel={() => setSettingsOpen(false)}
          onSave={applyPreferences}
        />
      )}
    </div>
  );
}
