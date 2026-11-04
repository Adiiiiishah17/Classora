import { cx } from "./ui";

export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cx("bouncy rounded-full px-4 py-2 text-sm font-bold sm:px-5",
            value === t
              ? "bg-brand-500 text-white"
              : "bg-gray-100 text-brand-700 hover:bg-brand-100 dark:bg-slate-900 dark:text-brand-200 dark:hover:bg-slate-800")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}