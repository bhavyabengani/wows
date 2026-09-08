"use client";

import { Dialog, DropdownMenu } from "radix-ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { PREVIEW_BANNER, previewUser, season } from "@/preview-data";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/play/allocate", label: "Play", match: "/play" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/research", label: "Research" },
  { href: "/learn", label: "Learn" },
  { href: "/events", label: "Events" },
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  const base = item.match ?? item.href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function PreviewBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-wows-accent/20 bg-wows-ink px-4 py-1.5 text-center text-xs text-wows-paper"
    >
      {PREVIEW_BANNER}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-wows-rule bg-wows-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-sm bg-wows-accent text-xs font-bold text-wows-surface"
          >
            W
          </span>
          <span className="text-sm font-semibold tracking-tight text-wows-ink">
            WOWS Portal
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
                      "inline-flex h-14 items-center border-b-2 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wows-accent-soft",
                      active
                        ? "border-wows-accent font-medium text-wows-ink"
                        : "border-transparent text-wows-muted hover:text-wows-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-wows-muted lg:inline">
            {season.name}, week {season.week} of {season.weeks}
          </span>
          <UserMenu />
          <MobileNav pathname={pathname} />
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
        className="grid size-8 place-items-center rounded-full border border-wows-rule bg-wows-paper text-xs font-semibold text-wows-ink hover:border-wows-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
      >
        {previewUser.initials}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-md border border-wows-rule bg-wows-surface p-1 text-sm shadow-sm"
        >
          <div className="px-2 py-2">
            <p className="font-medium text-wows-ink">{previewUser.name}</p>
            <p className="text-xs text-wows-muted">{previewUser.email}</p>
            <p className="mt-1 text-xs text-wows-muted">
              {previewUser.role}, {previewUser.vertical}, {previewUser.cohort}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-wows-rule" />
          <DropdownMenu.Item asChild>
            <Link
              href="/play/portfolio"
              className="block rounded-sm px-2 py-1.5 text-wows-ink outline-none data-[highlighted]:bg-wows-paper"
            >
              My portfolio
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/admin/audit"
              className="block rounded-sm px-2 py-1.5 text-wows-ink outline-none data-[highlighted]:bg-wows-paper"
            >
              Admin: audit log
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-wows-rule" />
          <DropdownMenu.Item
            className="rounded-sm px-2 py-1.5 text-wows-muted outline-none data-[highlighted]:bg-wows-paper"
            onSelect={(e) => e.preventDefault()}
          >
            Sign out (disabled in preview)
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Open navigation"
        className="grid size-9 place-items-center rounded-md text-wows-ink hover:bg-wows-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-wows-ink/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-wows-rule bg-wows-surface p-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-wows-ink">
              Navigate
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close navigation"
              className="grid size-9 place-items-center rounded-md text-wows-ink hover:bg-wows-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Primary navigation
          </Dialog.Description>
          <nav aria-label="Primary, mobile" className="mt-4">
            <ul className="flex flex-col">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Dialog.Close asChild>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wows-accent-soft",
                          active
                            ? "bg-wows-paper font-medium text-wows-ink"
                            : "text-wows-ink hover:bg-wows-paper",
                        )}
                      >
                        {item.label}
                      </Link>
                    </Dialog.Close>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="mt-auto text-xs text-wows-muted">
            {season.name}, week {season.week} of {season.weeks}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
