import type { Metadata } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import {
  MobileNav,
  PreviewBanner,
  SiteHeader,
} from "@/components/preview/shell";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// Type pairing per docs/DESIGN_DIRECTION.md. Self-hosted at build by next/font.
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "WOWS Portal", template: "%s — WOWS Portal" },
  description:
    "Member portal for Wolves of Wall Street, the student finance club at Ashoka University.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* The lit ground. Fixed, behind everything, pointer-transparent. */}
        <div className="ambient-bloom" aria-hidden="true" />
        <PreviewBanner />
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-8 pb-24 sm:px-6 md:pb-12">
          {children}
        </div>
        <SiteFooter />
        <MobileNav />
      </body>
    </html>
  );
}
