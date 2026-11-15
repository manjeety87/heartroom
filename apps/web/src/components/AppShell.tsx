"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useFollowSystemMode } from "@/lib/look";

const NAV = [
  { href: "/", label: "Games", alsoFor: ["/games/", "/play", "/r/"] },
  { href: "/leaderboard", label: "Ranks", alsoFor: [] },
  { href: "/history", label: "History", alsoFor: [] },
  { href: "/settings", label: "Settings", alsoFor: [] },
] as const;

/**
 * The frame around every page: a translucent bar that content scrolls under (solid when the
 * person asks for less transparency), so "where am I / where can I go" is always one glance away.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  useFollowSystemMode();
  const pathname = usePathname();
  return (
    <>
      {/* env() keeps the bar clear of the notch in standalone mode; no token can express it. */}
      <header className="sticky top-0 z-20 border-b border-line bg-paper/75 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl backdrop-saturate-150 contrast-more:bg-paper reduced-transparency:bg-paper reduced-transparency:backdrop-blur-none">
        <nav
          aria-label="Main"
          className="mx-auto flex h-14 max-w-3xl items-center gap-0.5 px-gutter sm:gap-1"
        >
          <Link
            href="/"
            className="mr-auto rounded-tile font-display text-title font-extrabold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
          >
            Heartroom
          </Link>
          {NAV.map(({ href, label, alsoFor }) => {
            // "/" is every path's prefix, so home only counts as itself.
            const isHere =
              (href === "/" ? pathname === "/" : pathname.startsWith(href)) ||
              alsoFor.some((prefix) => pathname.startsWith(prefix));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isHere ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-pill px-1.5 text-small sm:px-3 font-semibold transition-colors duration-(--duration-press) ease-out focus-visible:outline-2 focus-visible:outline-pen ${
                  isHere ? "bg-well text-ink" : "text-pencil hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </>
  );
}
