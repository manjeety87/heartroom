import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { isGoogleEnabled } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // Read at request time: whether Google is configured is a property of this deploy, not the build.
  await connection();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6">
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">Settings</h1>
      {/* The account section reads the URL (a failed Google sign-in comes back with ?signin=failed). */}
      <Suspense>
        <SettingsScreen isGoogleEnabled={isGoogleEnabled()} />
      </Suspense>
    </main>
  );
}
