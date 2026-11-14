import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Bibliothek",
  description: "Meine Spiele von Steam, PlayStation und Nintendo an einem Ort.",
  robots: { index: false, follow: false },
  // Covers and icons come from Steam, Sony, Nintendo and IGDB: do not tell them which page asked.
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
