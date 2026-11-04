import { useEffect } from "react";
import { Card } from "./ui";

// A popup for forms. Clicking outside does not close it, so typing is never lost by accident.
export default function FormModal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop-in max-h-[92dvh] w-full max-w-lg overflow-y-auto !rounded-b-none sm:!rounded-b-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bouncy rounded-full bg-brand-100 px-3 py-1 text-sm font-extrabold text-brand-700 dark:bg-slate-800 dark:text-brand-200"
          >
            ✕
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}