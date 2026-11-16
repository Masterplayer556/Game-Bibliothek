import type { Metadata, Viewport } from "next";
// Both fonts are served from this site (no request to a font service).
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource/jersey-15/400.css";
import { AppShell } from "@/components/AppShell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
      url: `${BASE_PATH}/splash/splash-${width * ratio}x${height * ratio}.jpg`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
};

export const viewport: Viewport = {
  // Same values as --color-bg in src/styles/tokens.css; the theme switch updates them at runtime.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebe8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#09081a" },
  ],
  // Lets the page reach under the notch and home indicator; the bars keep clear with safe-area padding.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script sets data-theme before React starts, so the attribute differs from the server's HTML.
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
