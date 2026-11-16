// Light or dark: follows the device unless I pick one. The choice lives in this browser only.
export type ThemeChoice = "auto" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "gb-theme";
const CHANGE_EVENT = "gb-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the first paint, so the page never flashes in the wrong theme.
 * Kept as a string because it must not wait for the app's JavaScript.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=c==="dark"||(c!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === "auto") return systemDark ? "dark" : "light";
  return choice;
}

/** Puts the theme on <html> and colours the browser bar like the page. */
export function applyTheme(): void {
  const theme = resolveTheme(readThemeChoice(), matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = theme;
  const background = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
  if (!background) return;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", background);
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode without storage: the choice still holds until the page is closed.
  }
  applyTheme();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls back when the choice changes here, in another tab, or when the device switches. */
export function subscribeTheme(onChange: () => void): () => void {
  const media = matchMedia(DARK_QUERY);
  const handle = () => {
    applyTheme();
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", handle);
  media.addEventListener("change", handle);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", handle);
    media.removeEventListener("change", handle);
  };
}
