import type { Metadata, Viewport } from "next";
// The display font is served from this site (no request to a font service).
import "@fontsource-variable/bricolage-grotesque/standard.css";
import { AppShell } from "@/components/AppShell";
import { withBasePath } from "@/lib/base-path";
import { THEME_BACKGROUND, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * iPhone screens in CSS pixels and pixel ratio; public/splash has a start screen for each
 * (made from design/app-icon.svg, see docs/PROGRESS.md).
 */
const SPLASH_SIZES: [number, number, number][] = [
  [375, 667, 2],
  [414, 896, 2],
  [375, 812, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
];

export const metadata: Metadata = {
  title: "Game Bibliothek",
  description: "Meine Spiele von Steam, PlayStation und Nintendo an einem Ort.",
  robots: { index: false, follow: false },
  // Covers and icons come from Steam, Sony, Nintendo and IGDB: do not tell them which page asked.
  referrer: "no-referrer",
  // On the home screen it opens like an app: full screen, its own name and icon.
  appleWebApp: {
    capable: true,
    title: "Bibliothek",
    statusBarStyle: "black-translucent",
    // Shown while the home-screen app starts, instead of a blank screen (one per iPhone size).
    startupImage: SPLASH_SIZES.map(([width, height, ratio]) => ({
      url: withBasePath(`/splash/splash-${width * ratio}x${height * ratio}.jpg`),
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
  // Next writes `capable` only as «mobile-web-app-capable». Safari on iPhone shows the start
  // screens and the translucent status bar only with its own name for it.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // The page background of each theme; a theme picked by hand recolours both at runtime.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_BACKGROUND.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_BACKGROUND.dark },
  ],
  // Lets the page reach under the notch and home indicator; the bars keep clear with safe-area padding.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script sets data-theme before React starts, so the attribute differs from the server's HTML.
    <html lang="de-CH" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
