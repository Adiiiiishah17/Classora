import { useState } from "react";

export default function AuthField({ label, icon, type = "text", error, ...p }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";

  return (
    <label className="block text-sm font-bold">
      <span className="mb-1.5 block">{label}</span>
      <span className="group relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg transition group-focus-within:scale-125">
          {icon}
        </span>
        <input
          type={isPw && show ? "text" : type}
          className={`w-full rounded-2xl border-2 bg-white py-3 pl-12 pr-12 text-sm font-semibold outline-none transition dark:bg-slate-900 ${
            error
              ? "border-rose-400 focus:ring-4 focus:ring-rose-200/60"
              : "border-brand-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-200/60 dark:border-slate-700 dark:focus:ring-brand-500/20"
          }`}
          {...p}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="bouncy absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-lg"
          >
            {show ? "🙈" : "👁️"}
          </button>
        )}
      </span>
      {error && <span className="mt-1 block text-xs font-bold text-rose-600 dark:text-rose-300">{error}</span>}
    </label>
  );
}