import type { Metadata, Viewport } from "next";
// Both fonts are served from this site (no request to a font service).
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource/jersey-15/400.css";
import { AppShell } from "@/components/AppShell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Bibliothek",
  description: "Meine Spiele von Steam, PlayStation und Nintendo an einem Ort.",
  robots: { index: false, follow: false },
  // Covers and icons come from Steam, Sony, Nintendo and IGDB: do not tell them which page asked.
  referrer: "no-referrer",
  // On the home screen it opens like an app: full screen, its own name and icon.
  appleWebApp: { capable: true, title: "Bibliothek", statusBarStyle: "black-translucent" },
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
