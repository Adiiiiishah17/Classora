import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

/* ===================== EDIT YOUR BRAND HERE ===================== */
export const BRAND = {
  name: "Meenal",
  logo: "/logo.png", // the file is at D:\Meenal\client\public\logo.png
  logoZoom: 1.9, // how close the logo is. Higher = closer. If the logo gets cut off, lower it (try 1.6)
  logoWhiten: true, // fades the light grey behind the logo to white. Set to false for a transparent PNG
  slogan: "Learn without limits.", // EDIT: your slogan. Use \n for a line break
  quoteLead: "No local coaching? Too expensive? Problem solved.",
  quoteRest: "Premium guidance, accessible to everyone, at a price that makes sense.",
  author: "Meenal",
};
/* =============================================================== */

// Top half of the brand column: the logo, zoomed so only the artwork shows
function LogoTile() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-48 overflow-hidden rounded-3xl bg-white shadow-lg shadow-black/20 sm:h-56 md:h-auto">
      <div className="absolute inset-0 flex items-center justify-center">
        {failed ? (
          // shown only if the logo file is missing
          <span className="font-heading text-7xl font-black text-brand-600">{BRAND.name.charAt(0)}</span>
        ) : (
          <img
            src={BRAND.logo}
            alt={`${BRAND.name} logo`}
            className="h-full w-auto max-w-none shrink-0"
            style={{
              transform: `scale(${BRAND.logoZoom})`,
              ...(BRAND.logoWhiten ? { filter: "brightness(1.12)" } : {}),
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

// Bottom half of the brand column: slogan and quote
function MessageBlock() {
  return (
    <div className="flex min-h-0 flex-col justify-center gap-4 text-white md:overflow-y-auto">
      <h2 className="whitespace-pre-line text-2xl font-extrabold leading-tight sm:text-3xl">{BRAND.slogan}</h2>
      <div aria-hidden className="h-0.5 w-12 rounded bg-white/70" />
      <figure>
        <blockquote>
          <p className="text-base font-bold leading-snug sm:text-lg">{BRAND.quoteLead}</p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-white/90">{BRAND.quoteRest}</p>
        </blockquote>
        <figcaption className="mt-3">
          <span className="inline-block rounded-md bg-accent-400 px-3 py-1 text-sm font-extrabold text-slate-900 shadow-md">
            By {BRAND.author}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-brand-600 to-brand-700 p-4 sm:p-6 md:sticky md:top-6 md:h-[min(40rem,calc(100dvh-3rem))] md:self-start">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-400/20 blur-2xl" />
      {/* two equal rows on laptops: logo on top, message below */}
      <div className="relative grid h-full grid-cols-1 gap-4 md:grid-rows-2">
        <LogoTile />
        <MessageBlock />
      </div>
    </aside>
  );
}

export default function AuthSplit({ children }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-clip bg-gradient-to-br from-brand-100 via-white to-accent-400/20 px-3 py-16 sm:px-6 dark:from-slate-950 dark:via-slate-900 dark:to-brand-700/20">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent-400/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />

      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>

      <div className="relative z-[1] w-full max-w-5xl animate-pop-in rounded-[2rem] bg-white p-3 shadow-2xl shadow-brand-500/25 ring-1 ring-brand-500/25 sm:p-4 dark:bg-slate-900 dark:shadow-none">
        <div className="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-4">
          <BrandPanel />
          {/* the form is centered when it is short, and the page scrolls when it is long */}
          <div className="min-w-0 md:flex md:items-center">
            <div className="mx-auto w-full max-w-md px-2 py-6 sm:px-6 md:py-10">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}