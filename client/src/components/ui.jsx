export const cx = (...a) => a.filter(Boolean).join(" ");

const inputCls =
  "w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900";

export function Button({ variant = "primary", className, ...p }) {
  const styles = {
    primary: "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-md shadow-brand-300/40 hover:brightness-110 dark:shadow-none",
    soft: "bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-500/20 dark:text-brand-200 dark:hover:bg-brand-500/30",
    danger: "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30",
  };
  return (
    <button
      className={cx("bouncy rounded-full px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}
      {...p}
    />
  );
}

export function Field({ label, className, ...p }) {
  return (
    <label className={cx("block text-sm font-semibold", className)}>
      <span className="mb-1 block">{label}</span>
      <input className={inputCls} {...p} />
    </label>
  );
}

export function Select({ label, children, className, ...p }) {
  return (
    <label className={cx("block text-sm font-semibold", className)}>
      <span className="mb-1 block">{label}</span>
      <select className={inputCls} {...p}>{children}</select>
    </label>
  );
}

export function Badge({ tone = "green", children }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    violet: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
    gray: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-200",
  };
  return <span className={cx("rounded-full px-3 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}

export function Alert({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
      {children}
    </div>
  );
}

export function Card({ className, ...p }) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-brand-500/20 bg-gray-100 p-5 shadow-lg shadow-brand-500/10 sm:p-6 dark:bg-slate-900 dark:shadow-none",
        className
      )}
      {...p}
    />
  );
}

// On phones the popup slides up from the bottom and scrolls if it is long
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto !rounded-b-none sm:!rounded-b-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
        {children}
      </Card>
    </div>
  );
}

// Orange label + bold title, like "WHAT I KNOW / My Skills"
export function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="text-center">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl md:text-5xl">{title}</h1>
      {children && <p className="mx-auto mt-3 max-w-2xl text-sm font-medium opacity-70 sm:text-base">{children}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
    </div>
  );
}