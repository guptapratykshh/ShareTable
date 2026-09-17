import { useEffect, type ReactNode } from "react";
import { Button } from "./Form";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Remove",
  cancelLabel = "Keep listing",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center px-5">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
      >
        <h2 id="confirm-modal-title" className="display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-6 text-muted">{body}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
