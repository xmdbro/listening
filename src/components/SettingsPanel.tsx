import { useCallback, useEffect, useRef, useState } from "react";
import type { BackgroundType, Preferences } from "../preferences";
import { validateWeatherCoordinates } from "../preferences";
import { MAX_LASTFM_USERNAME_LENGTH, validateLastFmUsername } from "../lastfm-user";

interface SettingsPanelProps {
  preferences: Preferences;
  onCancel: () => void;
  onSave: (preferences: Preferences) => void;
}

const backgroundOptions: Array<{ value: BackgroundType; label: string; detail: string }> = [
  { value: "artist", label: "Artist", detail: "Use Spotify artist art, with the album as fallback." },
  { value: "album", label: "Album", detail: "Use the current album cover across the viewport." },
  { value: "none", label: "None", detail: "Use a solid black background." }
];

export function SettingsPanel({ preferences, onCancel, onSave }: SettingsPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState(preferences);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimeout = useRef<number | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const beginClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimeout.current = window.setTimeout(() => onCancelRef.current(), 220);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        beginClose();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        event.key.toLowerCase() === "s"
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && !event.repeat
        && !target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        event.preventDefault();
        beginClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (closeTimeout.current !== null) window.clearTimeout(closeTimeout.current);
    };
  }, [beginClose]);

  function update<Key extends keyof Preferences>(key: Key, value: Preferences[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const validationError = validateLastFmUsername(draft.lastFmUsername)
      ?? validateWeatherCoordinates(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave({
      ...draft,
      displayName: draft.displayName.trim(),
      lastFmUsername: draft.lastFmUsername.trim(),
      weatherLatitude: draft.weatherLatitude.trim(),
      weatherLongitude: draft.weatherLongitude.trim()
    });
    beginClose();
  }

  return (
    <div
      className={`settings-backdrop ${closing ? "closing" : ""}`}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) beginClose();
      }}
    >
      <section className={`settings-panel ${closing ? "closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <form onSubmit={submit}>
          <header className="settings-header">
            <div>
              <p className="settings-kicker">account · display · weather · time</p>
              <h1 id="settings-title">Listening preferences</h1>
            </div>
            <span className="settings-shortcut">[s]</span>
          </header>

          <div className="settings-scroll">
            {error && <p className="settings-error" role="alert">{error}</p>}
            <fieldset>
              <legend><span>Last.fm account</span></legend>
              <p className="setting-description">Choose the account to follow. Leave blank to use the server default.</p>
              <div className="setting-text-input">
                <input
                  type="text"
                  maxLength={MAX_LASTFM_USERNAME_LENGTH}
                  aria-label="Last.fm username"
                  placeholder="Server default"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={draft.lastFmUsername}
                  onChange={(event) => update("lastFmUsername", event.target.value)}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend><span>Display name</span></legend>
              <p className="setting-description">Optional label shown instead of the Last.fm username.</p>
              <div className="setting-text-input">
                <input
                  type="text"
                  maxLength={40}
                  aria-label="Display name"
                  placeholder="e.g. Orpheus"
                  value={draft.displayName}
                  onChange={(event) => update("displayName", event.target.value)}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend><span>Background</span></legend>
              <div className="background-options">
                {backgroundOptions.map((option) => (
                  <label key={option.value} className={`background-option ${draft.backgroundType === option.value ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="background"
                      value={option.value}
                      checked={draft.backgroundType === option.value}
                      onChange={() => update("backgroundType", option.value)}
                    />
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </label>
                ))}
              </div>
              <label className="setting-toggle">
                <span><strong>Blur background</strong><small>Soften artwork behind the interface.</small></span>
                <input type="checkbox" checked={draft.blurBackground} onChange={(event) => update("blurBackground", event.target.checked)} />
              </label>
            </fieldset>

            <fieldset>
              <legend><span>Weather location</span></legend>
              <p className="setting-description">Leave both fields blank to use your browser location.</p>
              <div className="coordinate-grid">
                <label>
                  <span>Latitude</span>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    placeholder="Automatic"
                    value={draft.weatherLatitude}
                    onChange={(event) => update("weatherLatitude", event.target.value)}
                  />
                </label>
                <label>
                  <span>Longitude</span>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    placeholder="Automatic"
                    value={draft.weatherLongitude}
                    onChange={(event) => update("weatherLongitude", event.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend><span>Time and date</span></legend>
              <label className="setting-toggle">
                <span><strong>24-hour time</strong><small>Show 19:25 instead of 7:25 PM.</small></span>
                <input type="checkbox" checked={draft.use24HourTime} onChange={(event) => update("use24HourTime", event.target.checked)} />
              </label>
              <label className="setting-toggle">
                <span><strong>Show weekday</strong><small>Add the weekday before the date.</small></span>
                <input type="checkbox" checked={draft.showWeekday} onChange={(event) => update("showWeekday", event.target.checked)} />
              </label>
              <label className="setting-toggle">
                <span><strong>Show seconds</strong><small>Keep the clock ticking down to the second.</small></span>
                <input type="checkbox" checked={draft.showSeconds} onChange={(event) => update("showSeconds", event.target.checked)} />
              </label>
            </fieldset>
          </div>

          <footer className="settings-actions">
            <button type="button" className="secondary" onClick={beginClose}>Cancel</button>
            <button type="submit" className="primary">Save preferences</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
