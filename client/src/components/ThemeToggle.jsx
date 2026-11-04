import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="bouncy flex h-10 w-12 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-lg text-white shadow-md shadow-brand-500/40"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}