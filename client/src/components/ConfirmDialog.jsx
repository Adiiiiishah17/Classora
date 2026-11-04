import { useEffect } from "react";
import { Button } from "./ui";

export default function ConfirmDialog({
  open,
  icon = "🚪",
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  busy = false,
  busyText = "Working…",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        className="animate-pop-in w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">{icon}</div>
        <h2 id="confirm-title" className="mt-3 text-xl font-extrabold">{title}</h2>
        <p id="confirm-msg" className="mt-1 text-sm font-semibold opacity-70">{message}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="soft" className="flex-1" autoFocus disabled={busy} onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} className="flex-1" disabled={busy} onClick={onConfirm}>
            {busy ? busyText : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}