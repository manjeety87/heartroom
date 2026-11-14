import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameStats } from "@/features/admin/GameStats";
import { LiveRooms } from "@/features/admin/LiveRooms";
import { getAdmin } from "@/lib/admin/server";
import { readAdminStats } from "@/lib/admin/query";
import { getDb } from "@/lib/auth/server";

const TABS = [
  { id: "live", label: "Live rooms" },
  { id: "games", label: "Games" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Only an admin gets this title; anyone else gets the plain 404 page's. */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdmin()) === null
    ? {}
    : { title: "Admin", robots: { index: false, follow: false } };
}

/**
 * The author's dashboard. "Live rooms" polls the game server from the browser; "Games" is a query
 * over the database, rendered here. The tab lives in the URL so a refresh keeps it.
 */
export default async function AdminPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout already checked; a page can render on its own (e.g. a prefetch), so check again.
  if ((await getAdmin()) === null) notFound();
  const asked = (await searchParams)["tab"];
  const tab: TabId = TABS.find((t) => t.id === asked)?.id ?? "live";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-gutter py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">Admin</h1>
        <nav aria-label="Admin sections" className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "live" ? "/admin" : `/admin?tab=${t.id}`}
              aria-current={t.id === tab ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-pill px-3 text-small font-semibold transition-colors duration-(--duration-press) ease-out focus-visible:outline-2 focus-visible:outline-pen ${
                t.id === tab ? "bg-well text-ink" : "text-pencil hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {tab === "live" ? (
        <LiveRooms />
      ) : (
        <GameStats stats={await readAdminStats(getDb(), new Date())} />
      )}
    </main>
  );
}
