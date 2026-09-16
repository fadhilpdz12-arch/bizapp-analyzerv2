import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F6FA",
};

export const metadata: Metadata = {
  title: "Bizapp Analyzer",
  description: "Analisis return, penghantaran dan unjuran jualan dari export Bizapp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body text-content-100 min-h-screen">{children}</body>
    </html>
  );
}
