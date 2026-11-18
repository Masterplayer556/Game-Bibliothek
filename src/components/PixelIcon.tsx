// The icons of the pages as little 3D pixel models: each pixel is a cube. The fronts face you;
// the tops (lit) and the right sides (in shade) show the depth. Built once per icon from a
// pixel map into a handful of paths (one per colour and face), so they cost next to nothing.
import { memo } from "react";

/** How far the cubes reach back, in pixels (up and to the right). */
const DEPTH = 0.75;

interface Sprite {
  /** Rows of the picture; "." is empty, every other letter a colour from `colors`. */
  rows: string[];
  colors: Record<string, string>;
}

const SPRITES = {
  home: {
    rows: [
      ".....RR.....",
      "....RRRR....",
      "...RRRRRR.C.",
      "..RRRRRRRRC.",
      ".RRRRRRRRRR.",
      "RRRRRRRRRRRR",
      ".WWWWWWWWWW.",
      ".WBBWWWDDWW.",
      ".WBBWWWDDWW.",
      ".WWWWWWDDWW.",
      ".WWWWWWDDWW.",
      "GGGGGGGGGGGG",
    ],
    colors: { R: "#ef4b4b", W: "#fff4dc", B: "#5cc8ff", D: "#a8693a", G: "#4cc36a", C: "#8b8fa8" },
  },
  library: {
    rows: [
      "............",
      ".RR.........",
      ".RR.BB......",
      ".YY.BB.GG...",
      ".RR.YY.GG.PP",
      ".RR.BB.YY.PP",
      ".RR.BB.GG.YY",
      ".RR.BB.GG.PP",
      ".YY.YY.GG.PP",
      ".RR.BB.YY.PP",
      ".RR.BB.GG.PP",
      "SSSSSSSSSSSS",
    ],
    colors: { R: "#ef4b4b", B: "#4a8dff", G: "#35c27a", P: "#a465ff", Y: "#ffd23f", S: "#a8693a" },
  },
  stats: {
    rows: [
      "............",
      ".........GG.",
      ".........GG.",
      "......BB.GG.",
      "......BB.GG.",
      "......BB.GG.",
      "...YY.BB.GG.",
      "...YY.BB.GG.",
      "RR.YY.BB.GG.",
      "RR.YY.BB.GG.",
      "RR.YY.BB.GG.",
      "KKKKKKKKKKKK",
    ],
    colors: { R: "#ff5c8a", Y: "#ffb52e", B: "#4a8dff", G: "#35c27a", K: "#6b6f8e" },
  },
  trophy: {
    rows: [
      "..GGGGGGGG..",
      "GGGLGGGGGGGG",
      "G.GLGGGGGG.G",
      "G.GLGGGGGG.G",
      ".GGGGGGGGGG.",
      "..GGGGGGGG..",
      "...GGGGGG...",
      ".....GG.....",
      ".....GG.....",
      "...GGGGGG...",
      "..RRRRRRRR..",
      "..RRRRRRRR..",
    ],
    colors: { G: "#ffbf1f", L: "#ffe680", R: "#e8452f" },
  },
  chronicle: {
    rows: [
      "WWWWWWWWWWWW",
      ".CCCCCCCCCC.",
      ".CSSSSSSSSC.",
      "..CSSSSSSC..",
      "...CSSSSC...",
      "....CSSC....",
      "....CCSC....",
      "...CCCSCC...",
      "..CCCCSCCC..",
      ".CCCSSSSCCC.",
      ".CSSSSSSSSC.",
      "WWWWWWWWWWWW",
    ],
    colors: { W: "#a8693a", C: "#bfe9ff", S: "#ffc53d" },
  },
  review: {
    rows: [
      "....Y.......",
      "....Y.......",
      "...YYY......",
      "...YYY......",
      "YYYYWYYYY...",
      "...YYY......",
      "...YYY...P..",
      "....Y...PPP.",
      "....Y..PPWPP",
      "........PPP.",
      ".B.......P..",
      "............",
    ],
    colors: { Y: "#ffc53d", W: "#fff8d6", P: "#ff6fb5", B: "#5cc8ff" },
  },
  plus: {
    rows: [
      "............",
      "....GGGG....",
      "....GLGG....",
      "....GLGG....",
      ".GGGGGGGGGG.",
      ".GLLGGGGGGG.",
      ".GGGGGGGGGG.",
      ".GGGGGGGGGG.",
      "....GGGG....",
      "....GGGG....",
      "....GGGG....",
      "............",
    ],
    colors: { G: "#2fc46b", L: "#9af0b8" },
  },
  gamepad: {
    rows: [
      "............",
      "............",
      "..DD....DD..",
      ".DDDDDDDDDD.",
      "DDWDDDDDDRDD",
      "DWWWDDDDBDYD",
      "DDWDDDDDDGDD",
      "DDDDDDDDDDDD",
      "DDD......DDD",
      "DD........DD",
      "............",
      "............",
    ],
    colors: { D: "#5d62a8", W: "#ffffff", R: "#ff4d5e", B: "#4ab0ff", Y: "#ffd23f", G: "#35c27a" },
  },
  more: {
    rows: [
      "............",
      ".RRRR..BBBB.",
      ".RRRR..BBBB.",
      ".RRRR..BBBB.",
      ".RRRR..BBBB.",
      "............",
      "............",
      ".YYYY..GGGG.",
      ".YYYY..GGGG.",
      ".YYYY..GGGG.",
      ".YYYY..GGGG.",
      "............",
    ],
    colors: { R: "#ff5c6c", B: "#4a8dff", Y: "#ffc53d", G: "#35c27a" },
  },
  less: {
    rows: [
      "............",
      "............",
      ".....A......",
      "....AA......",
      "...AAA......",
      "..AAAAAAAAA.",
      "..AAAAAAAAA.",
      "...AAA......",
      "....AA......",
      ".....A......",
      "............",
      "............",
    ],
    colors: { A: "#8b8fa8" },
  },
} satisfies Record<string, Sprite>;

export type PixelIconName = keyof typeof SPRITES;

/** Mixes a hex colour with white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * a);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const f = (v: number) => +v.toFixed(3);

interface Built {
  width: number;
  height: number;
  /** Painted in order: all sides first, then the fronts, then the bevels on top. */
  layers: { d: string; fill: string; opacity?: number }[];
}

function build({ rows, colors }: Sprite): Built {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? (rows[y]![x] ?? ".") : ".");
  // Room on top for the depth.
  const oy = DEPTH;
  const tops: Record<string, string> = {};
  const sides: Record<string, string> = {};
  const fronts: Record<string, string> = {};
  let light = "";
  let dark = "";

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c === ".") continue;
      const X = x;
      const Y = y + oy;
      if (at(x, y - 1) === ".") {
        tops[c] = (tops[c] ?? "") + `M${f(X)} ${f(Y)}h1l${DEPTH} ${-DEPTH}h-1z`;
      }
      if (at(x + 1, y) === ".") {
        sides[c] = (sides[c] ?? "") + `M${f(X + 1)} ${f(Y)}v1l${DEPTH} ${-DEPTH}v-1z`;
      }
      fronts[c] = (fronts[c] ?? "") + `M${f(X)} ${f(Y)}h1v1h-1z`;
      // Each cube gets a lit upper edge and a shaded lower edge, so the pixels read as blocks.
      light += `M${f(X)} ${f(Y)}h1v.12h-.88v.88h-.12z`;
      dark += `M${f(X + 1)} ${f(Y + 1)}h-1v-.1h.9v-.9h.1z`;
    }
  }

  const layers: Built["layers"] = [];
  for (const [c, d] of Object.entries(sides)) layers.push({ d, fill: shade(colors[c] ?? "#888888", -0.32) });
  for (const [c, d] of Object.entries(tops)) layers.push({ d, fill: shade(colors[c] ?? "#888888", 0.28) });
  for (const [c, d] of Object.entries(fronts)) layers.push({ d, fill: colors[c] ?? "#888888" });
  layers.push({ d: light, fill: "#ffffff", opacity: 0.38 });
  layers.push({ d: dark, fill: "#000000", opacity: 0.16 });
  return { width: w + DEPTH, height: h + DEPTH, layers };
}

const BUILT = Object.fromEntries(Object.entries(SPRITES).map(([name, sprite]) => [name, build(sprite)])) as Record<PixelIconName, Built>;

export const PixelIcon = memo(function PixelIcon({ name, className = "h-6 w-6" }: { name: PixelIconName; className?: string }) {
  const { width, height, layers } = BUILT[name];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`pixel-icon shrink-0 ${className}`} aria-hidden focusable="false">
      {layers.map((layer, i) => (
        <path key={i} d={layer.d} fill={layer.fill} fillOpacity={layer.opacity} />
      ))}
    </svg>
  );
});
