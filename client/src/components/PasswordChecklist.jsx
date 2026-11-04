import { passwordRules } from "../utils/passwordPolicy";

export default function PasswordChecklist({ value }) {
  return (
    <ul className="space-y-1 rounded-2xl bg-brand-50 p-3 text-xs font-bold dark:bg-slate-800">
      {passwordRules.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.id} className={ok ? "text-emerald-600 dark:text-emerald-300" : "opacity-60"}>
            {ok ? "✅" : "⚪"} {r.label}
          </li>
        );
      })}
    </ul>
  );
}