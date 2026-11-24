import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultEmbedOptions, embedCardUrl, embedDimensions, embedSnippet, embedVisibility, embedWidths,
  maxEmbedWidth, parseEmbedWidth
} from "../embed-card";
import { CardOptions } from "./CardOptions";

const backgroundOptions = { artwork: "Artwork", solid: "Solid colour" };
const defaultBackground = "#171820";
const defaultTitle = "#f7f7f7";
const sizePresets = [
  { label: "Standard", width: embedWidths.standard },
  { label: "Compact", width: embedWidths.compact }
];
const formats = ["HTML", "Markdown"] as const;

type Preview = { request: { url: string; attempt: number } } & (
  { src: string } | { error: string; accountError?: boolean }
);

export function EmbedCardDialog({ username, displayName, accountLoading, onClose, onOpenPreferences }: {
  username: string;
  displayName: string;
  accountLoading: boolean;
  onClose: () => void;
  onOpenPreferences: () => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState(defaultEmbedOptions);
  const [widthInput, setWidthInput] = useState(String(defaultEmbedOptions.width));
  const [solidColour, setSolidColour] = useState(defaultBackground);
  const [format, setFormat] = useState<(typeof formats)[number]>("HTML");
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [copyResult, setCopyResult] = useState<{ code: string; copied: boolean } | null>(null);
  const url = username ? embedCardUrl(window.location.origin, username, displayName, options) : "";
  const request = useMemo(() => ({ url, attempt }), [url, attempt]);
  const code = url ? embedSnippet(url, format, options) : "";
  const invalidWidth = parseEmbedWidth(widthInput) === null;
  const currentCopy = !invalidWidth && copyResult?.code === code ? copyResult : null;
  const currentPreview = preview?.request === request ? preview : null;
  const { width, height } = embedDimensions(options.width);
  const hasSolidBackground = options.backgroundColor !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (!request.url) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let active = true;
    const delay = window.setTimeout(() => void loadPreview(), 160);
    const timeout = window.setTimeout(() => controller.abort(), 18_000);

    async function loadPreview(): Promise<void> {
      try {
        const response = await fetch(request.url, { signal: controller.signal, cache: request.attempt ? "reload" : "default" });
        if (!active) return;
        if (response.status === 400 || response.status === 403 || response.status === 404) {
          setPreview({ request, error: "This Last.fm account is unavailable for embeds.", accountError: true });
          return;
        }
        if (!response.ok || !response.headers.get("Content-Type")?.startsWith("image/svg+xml")) {
          throw new Error("Couldn’t load the card preview.");
        }
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ request, src: objectUrl });
      } catch {
        if (active) setPreview({ request, error: "Couldn’t load the card preview." });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    return () => {
      active = false;
      window.clearTimeout(delay);
      window.clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [request]);

  function dismiss(): void {
    dialogRef.current?.close();
    onClose();
  }

  function openPreferences(): void {
    dismiss();
    onOpenPreferences();
  }

  function updateWidth(input: string): void {
    setWidthInput(input);
    const width = parseEmbedWidth(input);
    if (width !== null) setOptions((current) => ({ ...current, width }));
  }

  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopyResult({ code, copied: true });
    } catch {
      setCopyResult({ code, copied: false });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog embed-dialog"
      aria-labelledby="embed-title"
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
          <h1 id="embed-title">Customise embed</h1>
          <button type="button" className="share-close" aria-label="Close embed customiser" onClick={dismiss}>×</button>
        </header>

        {username ? (
          <div className="embed-body">
            <div className="embed-preview-label">
              <p>Live Last.fm card for <strong>@{username}</strong></p>
              <output>{width} × {height}</output>
            </div>
            {currentPreview && "src" in currentPreview ? (
              <img
                className="embed-preview"
                src={currentPreview.src}
                alt={`Live listening card for @${username}`}
                width={width}
                height={height}
                onError={() => setPreview({ request, error: "Couldn’t display the card preview." })}
              />
            ) : (
              <div className="embed-preview-placeholder" style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}>
                {currentPreview && "error" in currentPreview ? (
                  <>
                    <p role="alert">{currentPreview.error}</p>
                    {currentPreview.accountError
                      ? <button type="button" onClick={openPreferences}>Open preferences</button>
                      : <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}
                  </>
                ) : <p role="status">Loading card preview…</p>}
              </div>
            )}

            <div className="share-customization">
              <div className="embed-adjustments">
                <fieldset className="share-fieldset">
                  <legend>Size</legend>
                  <div className="share-option-grid">
                    {sizePresets.map((preset) => (
                      <button
                        key={preset.width}
                        type="button"
                        className="embed-size-preset"
                        aria-pressed={!invalidWidth && width === preset.width}
                        onClick={() => updateWidth(String(preset.width))}
                      >
                        {preset.label}
                        <small>{preset.width} px</small>
                      </button>
                    ))}
                  </div>
                  <label className="embed-width-field" htmlFor="embed-width">
                    Custom width
                    <span className="embed-width">
                      <input
                        id="embed-width"
                        type="text"
                        inputMode="numeric"
                        aria-label="Custom width in pixels"
                        aria-invalid={invalidWidth}
                        aria-describedby={invalidWidth ? "embed-width-error" : undefined}
                        value={widthInput}
                        onChange={(event) => updateWidth(event.target.value)}
                      />
                      <span aria-hidden="true">px</span>
                    </span>
                  </label>
                  {invalidWidth && (
                    <p className="embed-width-error" id="embed-width-error" role="alert">
                      Enter a whole number from 1 to {maxEmbedWidth}.
                    </p>
                  )}
                </fieldset>
                <CardOptions
                  legend="Background"
                  name="embed-background"
                  options={backgroundOptions}
                  value={hasSolidBackground ? "solid" : "artwork"}
                  onChange={(value) => setOptions((current) => ({ ...current, backgroundColor: value === "solid" ? solidColour : null }))}
                >
                  <div className="embed-colours">
                    <label className="embed-colour-field">
                      Background color
                      <input
                        type="color"
                        disabled={!hasSolidBackground}
                        value={solidColour}
                        onChange={(event) => {
                          const backgroundColor = event.target.value;
                          setSolidColour(backgroundColor);
                          setOptions((current) => ({ ...current, backgroundColor }));
                        }}
                      />
                    </label>
                    <label className="embed-colour-field">
                      Title
                      <input type="color" aria-label="Title colour" value={options.titleColor ?? defaultTitle} onChange={(event) => setOptions({ ...options, titleColor: event.target.value })} />
                    </label>
                  </div>
                  {options.titleColor !== null && (
                    <button type="button" className="embed-choice embed-reset-colour" onClick={() => setOptions({ ...options, titleColor: null })}>Reset title colour</button>
                  )}
                </CardOptions>
              </div>
              <fieldset className="share-fieldset">
                <legend>Show on card</legend>
                <div className="share-visibility">
                  {(Object.keys(embedVisibility) as Array<keyof typeof embedVisibility>).map((field) => (
                    <label key={field} className="setting-toggle">
                      {embedVisibility[field]}
                      <input
                        type="checkbox"
                        checked={options.show[field]}
                        onChange={(event) => setOptions({ ...options, show: { ...options.show, [field]: event.target.checked } })}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        ) : (
          <div className="embed-body embed-account">
            {accountLoading ? <p role="status">Checking for a Last.fm account…</p> : (
              <>
                <p>Choose a Last.fm account in preferences to create an embed.</p>
                <button type="button" onClick={openPreferences}>Open preferences</button>
              </>
            )}
          </div>
        )}

        {username && (
          <footer className="share-actions embed-actions">
            <p className="share-copy-status" role="status">{currentCopy?.copied ? `${format} copied.` : ""}</p>
            <div className="embed-format" role="group" aria-label="Embed code format">
              {formats.map((option) => (
                <button key={option} type="button" className="embed-choice" aria-pressed={format === option} onClick={() => setFormat(option)}>{option}</button>
              ))}
            </div>
            <button type="button" className="primary" disabled={invalidWidth || !currentPreview || !("src" in currentPreview)} onClick={() => void copyCode()}>Copy embed code</button>
          </footer>
        )}
        {currentCopy && !currentCopy.copied && (
          <label className="share-link-feedback embed-code">
            Copy the embed code
            <textarea rows={3} readOnly value={code} onFocus={(event) => event.currentTarget.select()} />
          </label>
        )}
      </div>
    </dialog>
  );
}
