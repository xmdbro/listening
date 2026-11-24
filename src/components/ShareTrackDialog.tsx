import { useEffect, useRef, useState } from "react";
import { CardOptions } from "./CardOptions";
import { useCardDialog } from "../hooks/useCardDialog";
import { backgroundPresets, cardColors, drawSharePreview, loadShareAlbumScrobbles, loadShareArtwork, shareStats, SHARE_FORMATS, type ShareCardResources, type ShareTrack } from "../share-card";
import { shareImageUrl } from "../share-link";
import {
  defaultSharePreferences, loadSharePreferences, saveSharePreferences,
  shareBackgrounds, shareFormats, shareVisibility, type SharePreferences
} from "../share-preferences";

export function ShareTrackDialog({ snapshot, onClose }: { snapshot: ShareTrack; onClose: () => void }): React.JSX.Element {
  const { dialogRef, closing, dismiss } = useCardDialog("s", onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preferences, setPreferences] = useState(loadSharePreferences);
  const [resources, setResources] = useState<ShareCardResources | null>(null);
  const [exported, setExported] = useState<{ preferences: SharePreferences; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ url: string; copied: boolean } | null>(null);
  const { format, background, backgroundColor, blur, color, show } = preferences;
  const presets = resources?.backgroundPresets ?? [];
  const photoBackground = background === "artist" || background === "album";
  const dimensions = SHARE_FORMATS[format];
  const file = exported?.preferences === preferences ? exported.file : null;
  const imageUrl = shareImageUrl(window.location.origin, snapshot, preferences);
  const currentCopy = copyResult?.url === imageUrl ? copyResult : null;

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
      drawSharePreview(canvas, snapshot, preferences, resources);
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
    setCopyResult(null);
    setPreferences(next);
    saveSharePreferences(next);
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

  async function copyImageLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopyResult({ url: imageUrl, copied: true });
    } catch {
      setCopyResult({ url: imageUrl, copied: false });
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
      className={`share-dialog${closing ? " closing" : ""}`}
      aria-labelledby="share-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="share-dialog-content" inert={closing}>
        <header className="share-header">
          <h1 id="share-title">Share track</h1>
          <span className="settings-shortcut">[S]</span>
        </header>
        <CardOptions legend="Image format" name="share-format" options={shareFormats} value={format} onChange={(format) => updatePreferences({ ...preferences, format })} />
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
            <CardOptions legend="Background" name="share-background" options={shareBackgrounds} value={background} onChange={(background) => updatePreferences({ ...preferences, background })}>
              {photoBackground ? (
                <label className="setting-toggle">
                  Blur background
                  <input type="checkbox" checked={blur} onChange={(event) => updatePreferences({ ...preferences, blur: event.target.checked })} />
                </label>
              ) : (
                <fieldset className="share-fieldset share-background-color-options">
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
              <label className="setting-toggle">
                Artwork colors
                <input type="checkbox" checked={color === "artwork"} onChange={(event) => updatePreferences({ ...preferences, color: event.target.checked ? "artwork" : "neutral" })} />
              </label>
            </CardOptions>
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
          <p className="share-copy-status" role="status">{currentCopy?.copied ? "Link copied." : ""}</p>
          <button type="button" className="primary share-download" onClick={download} disabled={!file}>Download PNG</button>
          <button type="button" onClick={() => void copyImageLink()}>Share image</button>
        </footer>
        {currentCopy && !currentCopy.copied && (
          <label className="share-link-feedback setting-text-input">
            Copy the live image link
            <input type="url" readOnly value={imageUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
        )}
        {error && <p className="share-error" role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
