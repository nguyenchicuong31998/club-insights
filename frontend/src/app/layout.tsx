import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// Designed for Vietnamese, so player names like "Trần Hữu Tú" render with proper diacritics.
const sans = Be_Vietnam_Pro({ variable: "--font-vietnam", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Club Insights",
  description: "How your club is doing: active players, sessions held and no-shows, week by week.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions add attributes to <html>/<body> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
