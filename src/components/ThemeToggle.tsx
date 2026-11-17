"use client";

import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { applyTheme, readThemeChoice, saveThemeChoice, subscribeTheme, type ThemeChoice } from "@/lib/theme";

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

const OPTIONS: { id: ThemeChoice; label: string; icon: ReactNode }[] = [
  {
    id: "auto",
    label: "Wie das Gerät",
    icon: (
      <svg {...icon}>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "light",
    label: "Hell",
    icon: (
      <svg {...icon}>
        <circle cx="8" cy="8" r="2.75" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dunkel",
    icon: (
      <svg {...icon}>
        <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/** Three small buttons: follow the device, always light, always dark. A pill glides to the choice. */
export function ThemeToggle() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribeTheme, readThemeChoice, () => "auto");

  // The script in <head> has already set the theme; this also colours the browser bar.
  useEffect(() => applyTheme(), []);

  const index = OPTIONS.findIndex((o) => o.id === choice);
  return (
    <div
      role="group"
      aria-label="Design"
      className="segmented shrink-0 !p-[3px]"
      style={{ "--count": OPTIONS.length, "--index": index } as CSSProperties}
    >
      <span aria-hidden className="segmented-pill" />
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={choice === o.id}
          onClick={() => saveThemeChoice(o.id)}
          className="segmented-option flex h-7 w-8 items-center justify-center !p-0"
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
