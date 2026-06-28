import { useEffect } from "react";
import { useThemeStore } from "../stores/themeStore";

export function ThemeToggle() {
  const dark = useThemeStore((s) => s.dark);
  const toggle = useThemeStore((s) => s.toggle);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-900 transition-all duration-150 hover:bg-orange-100 active:scale-95 dark:border-gray-500 dark:bg-gray-800/50 dark:text-orange-300 dark:hover:bg-gray-700"
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      <span className="text-lg leading-none select-none">{dark ? "\u2600" : "\u263E"}</span>
    </button>
  );
}
