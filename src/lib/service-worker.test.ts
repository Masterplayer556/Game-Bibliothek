// public/sw.js is plain JavaScript; its pure parts are checked by running it in a sandbox.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Sandbox {
  strategyFor: (request: { method: string; url: string; mode?: string }, scope: string) => string | null;
  staticAssetsIn: (html: string, pageUrl: string) => string[];
  keyOf: (url: string) => string;
}

function load(): Sandbox {
  const sandbox: Record<string, unknown> = { self: { addEventListener: () => undefined }, URL, Set };
  runInNewContext(readFileSync(join(process.cwd(), "public", "sw.js"), "utf8"), sandbox);
  return sandbox as unknown as Sandbox;
}

const SCOPE = "https://example.github.io/Game-Bibliothek/";
const sw = load();

describe("service worker", () => {
  it("handles only GET requests of the app itself", () => {
    expect(sw.strategyFor({ method: "GET", url: `${SCOPE}_next/static/chunks/a1.js` }, SCOPE)).toBe("static");
    expect(sw.strategyFor({ method: "GET", url: `${SCOPE}bibliothek/`, mode: "navigate" }, SCOPE)).toBe("page");
    expect(sw.strategyFor({ method: "GET", url: `${SCOPE}bibliothek/index.txt?_rsc=1` }, SCOPE)).toBe("other");
    expect(sw.strategyFor({ method: "POST", url: `${SCOPE}x` }, SCOPE)).toBeNull();
    expect(sw.strategyFor({ method: "GET", url: "https://abc.supabase.co/rest/v1/games" }, SCOPE)).toBeNull();
    expect(sw.strategyFor({ method: "GET", url: "https://example.github.io/other-app/" }, SCOPE)).toBeNull();
  });

  it("finds the hashed files of a page, also inside the inline payload", () => {
    const html = `<script src="/Game-Bibliothek/_next/static/chunks/a1.js"></script>
      <link rel="stylesheet" href="/Game-Bibliothek/_next/static/css/b2.css"/>
      <script>self.__next_f.push([1,"\\"/Game-Bibliothek/_next/static/chunks/c3.js\\""])</script>
      <img src="https://images.igdb.com/x.jpg">`;
    expect(sw.staticAssetsIn(html, `${SCOPE}bibliothek/`).sort()).toEqual([
      `${SCOPE}_next/static/chunks/a1.js`,
      `${SCOPE}_next/static/chunks/c3.js`,
      `${SCOPE}_next/static/css/b2.css`,
    ]);
  });

  it("keeps one copy per page, whatever the query", () => {
    expect(sw.keyOf(`${SCOPE}spiel/?id=123#top`)).toBe(`${SCOPE}spiel/`);
  });
});
