import { useEffect, useRef, useState } from "react";
import { backgroundPresets, cardColors, drawShareCard, loadShareAlbumScrobbles, loadShareArtwork, shareStats, SHARE_FORMATS, type ShareCardResources, type ShareTrack } from "../share-card";
import {
  defaultSharePreferences, loadSharePreferences, saveSharePreferences,
  shareBackgrounds, shareColors, shareFormats, shareVisibility, type SharePreferences
} from "../share-preferences";

function ShareOptions<Value extends string>({ legend, name, options, value, onChange }: {
  legend: string;
  name: string;
  options: Record<Value, string>;
  value: Value;
  onChange: (value: Value) => void;
}): React.JSX.Element {
  return (
    <fieldset className="share-fieldset">
      <legend>{legend}</legend>
      <div className="share-option-grid">
        {(Object.keys(options) as Value[]).map((option) => (
          <label key={option}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            {options[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ShareTrackDialog({ snapshot, onClose }: { snapshot: ShareTrack; onClose: () => void }): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preferences, setPreferences] = useState(loadSharePreferences);
  const [resources, setResources] = useState<ShareCardResources | null>(null);
  const [exported, setExported] = useState<{ preferences: SharePreferences; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const { format, background, backgroundColor, blur, color, show } = preferences;
  const presets = resources?.backgroundPresets ?? [];
  const photoBackground = background === "artist" || background === "album";
  const dimensions = SHARE_FORMATS[format];
  const file = exported?.preferences === preferences ? exported.file : null;
  const canShare = file && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cover = loadShareArtwork(snapshot.track.imageUrl, controller.signal);
    const artistPhoto = snapshot.artistImageUrl === snapshot.track.imageUrl
      ? cover
      : loadShareArtwork(snapshot.artistImageUrl, controller.signal);
    void Promise.all([
      cover,
      artistPhoto,
      loadShareAlbumScrobbles(snapshot, controller.signal),
      Promise.allSettled([
        document.fonts.load('300 68px "Open Sans"'),
        document.fonts.load('400 42px "Open Sans"'),
        document.fonts.load('400 25px "Source Code Pro"')
      ])
    ]).then(([cover, artistPhoto, albumScrobbles]) => {
      if (!controller.signal.aborted) {
        setResources({ cover, artistPhoto, albumScrobbles, artworkColors: cardColors(cover), backgroundPresets: backgroundPresets(cover) });
      }
    });
    return () => controller.abort();
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resources) return;

    let active = true;
    try {
      drawShareCard(canvas, snapshot, preferences, resources);
      canvas.toBlob((blob) => {
        if (!active) return;
        if (!blob) {
          setError("Couldn’t create the PNG. Try switching formats.");
          return;
        }

        const slug = snapshot.track.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64).replace(/^-+|-+$/g, "");
        const file = new File([blob], `listening-${slug || "track"}-${preferences.format}.png`, { type: "image/png" });
        setExported({ preferences, file });
      }, "image/png");
    } catch {
      setError("Couldn’t render this card. Try switching formats.");
    }

    return () => { active = false; };
  }, [resources, preferences, snapshot]);

  function updatePreferences(next: SharePreferences): void {
    if (next === preferences) return;
    setExported(null);
    setError(null);
    setPreferences(next);
    saveSharePreferences(next);
  }

  function dismiss(): void {
    dialogRef.current?.close();
    onClose();
  }

  function download(): void {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    dialogRef.current?.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function share(): Promise<void> {
    if (!file || sharing) return;

    setSharing(true);
    setError(null);
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError("Couldn’t open sharing. You can still download the PNG.");
      }
    } finally {
      setSharing(false);
    }
  }

  const imageDescription = [
    show.displayName && snapshot.displayName,
    show.status && (snapshot.isPlaying ? "Now playing" : "Last played"),
    `${snapshot.track.name} by ${snapshot.track.artist}`,
    show.album && snapshot.track.album,
    ...shareStats(snapshot, resources?.albumScrobbles ?? null, show).map(({ description }) => description)
  ].filter(Boolean).join(" · ");

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog"
      aria-labelledby="share-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="share-dialog-content">
        <header className="share-header">
          <h1 id="share-title">Share track</h1>
          <button type="button" className="share-close" aria-label="Close share preview" onClick={dismiss}>×</button>
        </header>
        <ShareOptions legend="Image format" name="share-format" options={shareFormats} value={format} onChange={(format) => updatePreferences({ ...preferences, format })} />
        <div className="share-editor">
          <div className="share-preview" data-format={format} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
            {!resources && <span role="status">Preparing preview…</span>}
            <canvas
              ref={canvasRef}
              hidden={!resources}
              role="img"
              aria-label={imageDescription}
            />
          </div>
          <div className="share-customization">
            <ShareOptions legend="Background" name="share-background" options={shareBackgrounds} value={background} onChange={(background) => updatePreferences({ ...preferences, background })} />
            {photoBackground ? (
              <label className="setting-toggle">
                Blur background
                <input type="checkbox" checked={blur} onChange={(event) => updatePreferences({ ...preferences, blur: event.target.checked })} />
              </label>
            ) : (
              <fieldset className="share-fieldset">
                <legend>Background color</legend>
                <div className="share-background-colors">
                  <div className="share-color-presets">
                    <label className="share-color-swatch">
                      <input type="radio" name="share-background-color" checked={backgroundColor === null} onChange={() => updatePreferences({ ...preferences, backgroundColor: null })} />
                      Auto
                    </label>
                    {[...presets, "#000000"].map((preset, index) => (
                      <label key={preset} className="share-color-swatch" style={{ backgroundColor: preset }} title={preset === "#000000" ? "Black" : preset}>
                        <input type="radio" name="share-background-color" aria-label={preset === "#000000" ? "Black" : `Color preset ${index + 1} (${preset})`} checked={backgroundColor === preset} onChange={() => updatePreferences({ ...preferences, backgroundColor: preset })} />
                      </label>
                    ))}
                  </div>
                  <label className="share-custom-color">
                    <span aria-hidden="true">Custom</span>
                    <input type="color" aria-label="Custom background color" value={backgroundColor ?? presets[0] ?? "#171820"} onChange={(event) => updatePreferences({ ...preferences, backgroundColor: event.target.value })} />
                  </label>
                </div>
              </fieldset>
            )}
            <ShareOptions legend="Color" name="share-color" options={shareColors} value={color} onChange={(color) => updatePreferences({ ...preferences, color })} />
            <fieldset className="share-fieldset">
              <legend>Show on card</legend>
              <div className="share-visibility">
                {(Object.keys(shareVisibility) as Array<keyof typeof shareVisibility>).map((key) => (
                  <label key={key} className="setting-toggle">
                    {shareVisibility[key]}
                    <input type="checkbox" checked={show[key]} onChange={(event) => updatePreferences({ ...preferences, show: { ...show, [key]: event.target.checked } })} />
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={() => updatePreferences(defaultSharePreferences)}>Reset to default</button>
          </div>
        </div>
        <footer className="share-actions">
          <button type="button" className="primary share-download" onClick={download} disabled={!file}>Download PNG</button>
          {canShare && <button type="button" onClick={() => void share()} disabled={sharing}>Share image</button>}
        </footer>
        {error && <p className="share-error" role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
