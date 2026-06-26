"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("theme", theme);
}

export function ThemeToggle() {
  // Mirrors the inline bootstrap script in the root layout, which already set
  // documentElement.dataset.theme before hydration to avoid a flash of the
  // wrong theme; this just syncs React state to whatever it picked.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className="secondary theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "切換為亮色主題" : "切換為暗色主題"}
      title={theme === "dark" ? "切換為亮色主題" : "切換為暗色主題"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
