import ThemeToggle from "./ThemeToggle";

const floaters = [
  ["📚", "left-[6%] top-[12%]", "animate-float text-5xl"],
  ["✏️", "left-[16%] bottom-[12%]", "animate-float-slow text-4xl"],
  ["🎒", "right-[8%] top-[16%]", "animate-float-slow text-6xl"],
  ["⭐", "right-[18%] bottom-[10%]", "animate-float text-4xl"],
  ["🔔", "left-[44%] top-[4%]", "animate-float text-3xl"],
  ["🏫", "right-[3%] bottom-[38%]", "animate-float-slow text-5xl"],
  ["🎨", "left-[3%] top-[55%]", "animate-float text-4xl"],
];

export default function AuthShell({ children, wide = false }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-white to-accent-400/20 px-4 py-16 dark:from-slate-950 dark:via-slate-900 dark:to-brand-700/20">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent-400/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />

      {floaters.map(([emoji, pos, anim]) => (
        <span key={emoji} aria-hidden className={`pointer-events-none absolute select-none opacity-70 max-sm:opacity-30 ${pos} ${anim}`}>
          {emoji}
        </span>
      ))}

      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>
      <div className={`relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</div>
    </div>
  );
}

export function AuthCard({ mascot = "🎓", children }) {
  return (
    <div className="relative animate-pop-in rounded-[2rem] bg-white/90 px-6 pb-8 pt-14 shadow-2xl shadow-brand-300/40 ring-1 ring-brand-500/25 backdrop-blur dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800 sm:px-10">
      <div className="absolute -top-10 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-4xl shadow-xl shadow-brand-400/40 ring-4 ring-white dark:ring-slate-900">
        <span className="inline-block cursor-default hover:animate-wiggle">{mascot}</span>
      </div>
      {children}
    </div>
  );
}