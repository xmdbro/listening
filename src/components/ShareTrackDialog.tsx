import { useEffect, useRef, useState } from "react";
import { drawShareCard, loadShareAlbumScrobbles, loadShareArtwork, shareStats, SHARE_FORMATS, type ShareCardResources, type ShareFormat, type ShareTrack } from "../share-card";

export function ShareTrackDialog({ snapshot, onClose }: { snapshot: ShareTrack; onClose: () => void }): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<ShareFormat>("square");
  const [resources, setResources] = useState<ShareCardResources | null>(null);
  const [exported, setExported] = useState<{ format: ShareFormat; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const dimensions = SHARE_FORMATS[format];
  const file = exported?.format === format ? exported.file : null;
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
      if (!controller.signal.aborted) setResources({ cover, artistPhoto, albumScrobbles });
    });
    return () => controller.abort();
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resources) return;

    let active = true;
    try {
      drawShareCard(canvas, snapshot, format, resources);
      canvas.toBlob((blob) => {
        if (!active) return;
        if (!blob) {
          setError("Couldn’t create the PNG. Try switching formats.");
          return;
        }

        const slug = snapshot.track.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64).replace(/^-+|-+$/g, "");
        const file = new File([blob], `listening-${slug || "track"}-${format}.png`, { type: "image/png" });
        setExported({ format, file });
      }, "image/png");
    } catch {
      setError("Couldn’t render this card. Try switching formats.");
    }

    return () => { active = false; };
  }, [resources, format, snapshot]);

  function chooseFormat(next: ShareFormat): void {
    if (next === format) return;
    setExported(null);
    setError(null);
    setFormat(next);
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
    snapshot.displayName,
    snapshot.isPlaying ? "Now playing" : "Last played",
    `${snapshot.track.name} by ${snapshot.track.artist}`,
    snapshot.track.album,
    ...shareStats(snapshot, resources?.albumScrobbles ?? null).map(({ description }) => description)
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
        <fieldset className="share-formats">
          <legend>Image format</legend>
          <div className="share-format-options">
            {(Object.keys(SHARE_FORMATS) as ShareFormat[]).map((option) => (
              <label key={option}>
                <input type="radio" name="share-format" value={option} checked={format === option} onChange={() => chooseFormat(option)} />
                {SHARE_FORMATS[option].label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="share-preview" data-format={format} style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
          {!resources && <span role="status">Preparing preview…</span>}
          <canvas
            ref={canvasRef}
            hidden={!resources}
            role="img"
            aria-label={imageDescription}
          />
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
