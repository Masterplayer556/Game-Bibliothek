// Renders the app icon in every size and the iPhone start screens from design/app-icon.svg.
// Needs Playwright with Chromium (not a project dependency): node scripts/render-app-images.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Playwright is installed globally, not in this project: load it the CommonJS way.
const load = createRequire(import.meta.url);
const { chromium } = load("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = fs.readFileSync(path.join(root, "design/app-icon.svg"), "utf8");
const ICONS = [
  [512, "public/icon-512.png"],
  [192, "public/icon-192.png"],
  [96, "public/icon-96.png"],
  [180, "src/app/apple-icon.png"],
];
// iPhone screens: [css width, css height, pixel ratio]; keep in step with SPLASH_SIZES in src/app/layout.tsx.
const SPLASH = [[375, 667, 2], [414, 896, 2], [375, 812, 3], [390, 844, 3], [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3]];

const splashHtml = `<!doctype html><html><head>
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/bricolage-grotesque/standard.css">
<style>
html,body{margin:0;height:100%}
body{background:#08061a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;overflow:hidden;position:relative;
 background-image:radial-gradient(28rem 20rem at 0% 0%, rgba(133,119,255,.42), transparent 70%),
  radial-gradient(24rem 18rem at 100% 8%, rgba(192,123,255,.26), transparent 70%),
  radial-gradient(30rem 22rem at 110% 85%, rgba(255,47,180,.24), transparent 70%),
  radial-gradient(26rem 20rem at -10% 70%, rgba(25,227,255,.14), transparent 70%),
  linear-gradient(to bottom, transparent 55%, rgba(123,92,255,.22))}
.grid{position:absolute;left:-60%;right:-60%;bottom:0;height:42%;opacity:.7;
 background-image:linear-gradient(to right, rgba(133,119,255,.55) 1.5px, transparent 1.5px),linear-gradient(to top, rgba(133,119,255,.55) 1.5px, transparent 1.5px);
 background-size:56px 56px;background-position:center bottom;transform:perspective(260px) rotateX(64deg);transform-origin:50% 100%;
 -webkit-mask-image:linear-gradient(to top, black, transparent 80%)}
img{position:relative;width:34%;border-radius:22%;box-shadow:0 24px 50px -18px rgba(0,0,0,.7), 0 0 60px -10px rgba(133,119,255,.6)}
.w{position:relative;font-family:"Bricolage Grotesque Variable";font-weight:800;font-size:36px;letter-spacing:-.02em;color:#f4f2ff}
.g{background:linear-gradient(90deg,#9d85ff,#ff5cc0);-webkit-background-clip:text;color:transparent}
</style></head><body><div class="grid"></div><img src="file://${root}/public/icon-512.png"><div class="w"><span class="g">Game</span> Bibliothek</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  for (const [size, file] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(root, file) });
    await page.close();
  }
  fs.copyFileSync(path.join(root, "design/app-icon.svg"), path.join(root, "src/app/icon.svg"));

  const tmp = path.join(root, "public/splash/_splash.html");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, splashHtml);
  for (const [w, h, r] of SPLASH) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    await page.goto(`file://${tmp}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, `public/splash/splash-${w * r}x${h * r}.jpg`), type: "jpeg", quality: 88 });
    await page.close();
  }
  fs.unlinkSync(tmp);
  await browser.close();
})();
