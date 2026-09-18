import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[11px] font-extrabold text-muted transition hover:-translate-y-px hover:border-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" strokeWidth={2.2} /> : <Moon className="size-4" strokeWidth={2.2} />}
      <span className={compact ? "hidden sm:inline" : undefined}>{compact ? (theme === "dark" ? "Light" : "Dark") : theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
