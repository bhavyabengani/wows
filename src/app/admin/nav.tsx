"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const ADMIN = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/audit", label: "Audit log" },
];

/** Second-level navigation inside the admin surface. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="border-b border-wows-rule">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {ADMIN.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 py-2 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wows-accent-soft",
                  active
                    ? "border-wows-accent font-semibold text-wows-ink"
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
  );
}
