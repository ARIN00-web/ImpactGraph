"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getClientTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem("impactgraph-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    return "dark";
  }
  return "dark"; // Default is dark per Blast Map spec
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("impactgraph-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("impactgraph-theme-change", onChange);
  };
}

function applyTheme(target: Theme) {
  document.documentElement.dataset.theme = target;
  document.documentElement.classList.toggle("dark", target === "dark");
  document.documentElement.style.colorScheme = target;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const currentTheme = useSyncExternalStore<Theme>(
    subscribeToTheme,
    getClientTheme,
    () => "dark"
  );
  function toggleTo(target: Theme) {
    try {
      window.localStorage.setItem("impactgraph-theme", target);
    } catch {}
    applyTheme(target);
    window.dispatchEvent(new Event("impactgraph-theme-change"));
  }

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className={`inline-flex items-center p-0.5 rounded-[8px] border border-[var(--l)] bg-[var(--p)] select-none shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => toggleTo("light")}
        aria-label="Light mode"
        aria-pressed={currentTheme === "light"}
        className={`px-2 py-1 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
          currentTheme === "light"
            ? "bg-[var(--q)] text-[var(--t)] shadow-none"
            : "text-[var(--m)] hover:text-[var(--t)]"
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        type="button"
        onClick={() => toggleTo("dark")}
        aria-label="Dark mode"
        aria-pressed={currentTheme === "dark"}
        className={`px-2 py-1 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
          currentTheme === "dark"
            ? "bg-[var(--q)] text-[var(--t)] shadow-none"
            : "text-[var(--m)] hover:text-[var(--t)]"
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
