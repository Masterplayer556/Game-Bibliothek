// Light or dark: follows the device unless I pick one. The choice lives in this browser only.
export type ThemeChoice = "auto" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "gb-theme";
const CHANGE_EVENT = "gb-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The page background per theme (--color-bg in src/styles/tokens.css): the browser bar's colour. */
export const THEME_BACKGROUND: Record<Theme, string> = { light: "#f3efff", dark: "#08061a" };

/**
 * Runs in <head> before the first paint, so the page never flashes in the wrong theme. It also
 * colours the browser bar for a theme picked by hand (the theme-color tags only know the
 * device's setting), now and once the rest of <head> is there.
 * Kept as a string because it must not wait for the app's JavaScript.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=c==="dark"||(c!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var t=d?"dark":"light";document.documentElement.dataset.theme=t;if(c!=="dark"&&c!=="light")return;var b=${JSON.stringify(THEME_BACKGROUND)}[t];var p=function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",b)};p();document.addEventListener("DOMContentLoaded",p)}catch(e){}})()`;

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
  const background = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || THEME_BACKGROUND[theme];
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
  // Safari before 14 only knows addListener: without it the device's switch went unnoticed
  // (and the subscription threw).
  if (typeof media.addEventListener === "function") media.addEventListener("change", handle);
  else media.addListener(handle);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", handle);
    if (typeof media.removeEventListener === "function") media.removeEventListener("change", handle);
    else media.removeListener(handle);
  };
}
