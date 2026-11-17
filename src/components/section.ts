// Every part of the app has its own colour gradient (tokens --color-section-<name>-a/-b/-ink).
// Setting these three variables on an element colours everything inside it: icon tiles,
// highlights, bars, the glow behind the page.
import type { CSSProperties } from "react";

export type Section = "home" | "library" | "stats" | "achievements" | "chronicle" | "review" | "add" | "platforms";

export function sectionStyle(section: Section): CSSProperties {
  return {
    "--section": `var(--color-section-${section}-a)`,
    "--section-2": `var(--color-section-${section}-b)`,
    "--section-ink": `var(--color-section-${section}-ink)`,
  } as CSSProperties;
}
