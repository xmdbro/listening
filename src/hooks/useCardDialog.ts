import { useCallback, useEffect, useRef, useState } from "react";

const closeAnimationMs = 220;

export function useCardDialog(shortcut: "s" | "c", onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback((afterClose?: () => void) => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closeTimer.current !== null) return;

    const finishClose = () => {
      dialog.close();
      onClose();
      afterClose?.();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }

    setClosing(true);
    closeTimer.current = window.setTimeout(finishClose, closeAnimationMs);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
      dialog.close();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== shortcut || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input:not([type="radio"], [type="checkbox"]), textarea, select') || target?.isContentEditable) return;

      event.preventDefault();
      dismiss();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, shortcut]);

  return { dialogRef, closing, dismiss };
}
