"use client";

import { DropdownMenu } from "radix-ui";
import {
  BookOpen,
  CalendarDays,
  FileText,
  Gauge,
  Play,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { PREVIEW_BANNER, previewUser, season } from "@/preview-data";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/play/allocate", label: "Play", match: "/play", icon: Play },
  { href: "/leaderboard", label: "Leaderboard", short: "Board", icon: Trophy },
  { href: "/research", label: "Research", icon: FileText },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/events", label: "Events", icon: CalendarDays },
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  const base = item.match ?? item.href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function PreviewBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-wows-rule bg-wows-paper px-4 py-1 text-center text-[12.5px] text-wows-muted"
    >
      {PREVIEW_BANNER}
    </div>
  );
}

/** The masthead: the club's colour as a surface, not an accent. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="bg-wows-accent text-wows-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wows-paper"
        >
          <span className="text-lg font-bold tracking-tight">WOWS</span>
          <span className="hidden text-sm text-wows-paper/70 sm:inline">
            Portal
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-14 items-center border-b-2 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-wows-paper",
                      active
                        ? "border-wows-paper font-semibold text-wows-paper"
                        : "border-transparent text-wows-paper/75 hover:text-wows-paper",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="numeric hidden text-xs text-wows-paper/70 lg:inline">
            {season.name} · wk {season.week}/{season.weeks}
          </span>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account: ${previewUser.name}`}
        className="grid size-8 place-items-center rounded-full bg-wows-paper text-xs font-semibold text-wows-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-paper"
      >
        {previewUser.initials}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 border border-wows-rule bg-wows-surface p-1 text-sm"
        >
          <div className="px-2 py-2">
            <p className="font-semibold text-wows-ink">{previewUser.name}</p>
            <p className="text-xs text-wows-muted">{previewUser.email}</p>
            <p className="mt-1 text-xs text-wows-muted">
              {previewUser.role}, {previewUser.vertical}, {previewUser.cohort}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-wows-rule" />
          <DropdownMenu.Item asChild>
            <Link
              href="/play/portfolio"
              className="block px-2 py-1.5 text-wows-ink outline-none data-[highlighted]:bg-wows-paper"
            >
              My portfolio
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/admin/audit"
              className="block px-2 py-1.5 text-wows-ink outline-none data-[highlighted]:bg-wows-paper"
            >
              Admin: audit log
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-wows-rule" />
          <DropdownMenu.Item
            className="px-2 py-1.5 text-wows-muted outline-none data-[highlighted]:bg-wows-paper"
            onSelect={(e) => e.preventDefault()}
          >
            Sign out (disabled in preview)
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Bottom navigation on phones. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary, mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-wows-rule bg-wows-surface md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wows-accent-soft",
                  active ? "font-semibold text-wows-accent" : "text-wows-muted",
                )}
              >
                <Icon
                  className="size-5"
                  aria-hidden="true"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {item.short ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
