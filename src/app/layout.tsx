import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PreviewBanner, SiteHeader } from "@/components/preview/shell";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WOWS Portal", template: "%s — WOWS Portal" },
  description:
    "Member portal for Wolves of Wall Street, the student finance club at Ashoka University.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <PreviewBanner />
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
