// The folder the site is served from (GitHub Pages: /<repo>). Set by NEXT_PUBLIC_BASE_PATH;
// empty or "/" for a custom domain. Used by next.config.ts and for every URL of a file in
// public/, so the value is cleaned the same way everywhere.

/** "" or "/" → "", "repo/" → "/repo", "/repo/" → "/repo". */
export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/** URL of a file in public/: `withBasePath("/icon-96.png")` → "/Game-Bibliothek/icon-96.png". */
export function withBasePath(path: string, basePath: string = BASE_PATH): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}
