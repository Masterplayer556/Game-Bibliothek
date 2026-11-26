import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_BACKGROUND, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

/** Runs the <head> script against a stand-in page; returns the theme and the bar colours. */
function runInit(stored: string | null, systemDark: boolean) {
  const metas = ["#light-from-next", "#dark-from-next"].map((content) => ({
    content,
    setAttribute(_name: string, value: string) {
      this.content = value;
    },
  }));
  const listeners: (() => void)[] = [];
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    querySelectorAll: () => metas,
    addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
  };
  const localStorage = { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) };
  const matchMedia = () => ({ matches: systemDark });
  new Function("document", "localStorage", "matchMedia", THEME_INIT_SCRIPT)(document, localStorage, matchMedia);
  return { theme: document.documentElement.dataset.theme, bar: metas.map((m) => m.content), listeners: listeners.length };
}

describe("theme", () => {
  it("follows the device unless a theme was picked", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("sets the theme before the first paint and colours the bar for a theme picked by hand", () => {
    expect(runInit(null, true)).toEqual({ theme: "dark", bar: ["#light-from-next", "#dark-from-next"], listeners: 0 });
    expect(runInit("dark", false)).toEqual({ theme: "dark", bar: [THEME_BACKGROUND.dark, THEME_BACKGROUND.dark], listeners: 1 });
    expect(runInit("light", true)).toEqual({ theme: "light", bar: [THEME_BACKGROUND.light, THEME_BACKGROUND.light], listeners: 1 });
  });

  it("uses the same backgrounds as the design tokens", () => {
    const tokens = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");
    const backgrounds = [...tokens.matchAll(/--color-bg:\s*(#[0-9a-f]+)/gi)].map((m) => m[1]);
    expect(backgrounds).toEqual([THEME_BACKGROUND.light, THEME_BACKGROUND.dark]);
  });
});
