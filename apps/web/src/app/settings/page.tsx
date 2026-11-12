import type { Metadata } from "next";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6">
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">Settings</h1>
      <SettingsScreen />
    </main>
  );
}
