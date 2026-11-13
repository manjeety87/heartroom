import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { roomCodeInput } from "@heartroom/protocol";
import { RoomScreen } from "@/features/room/RoomScreen";

type Props = { readonly params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = roomCodeInput.safeParse((await params).code);
  return { title: parsed.success ? `Room ${parsed.data}` : "Room" };
}

/** A shared link: `/r/ab3k9q` and `/r/AB3-K9Q` both open room AB3K9Q. A malformed code is a 404. */
export default async function RoomPage({ params }: Props) {
  const parsed = roomCodeInput.safeParse((await params).code);
  if (!parsed.success) notFound();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-gutter py-6">
      <RoomScreen code={parsed.data} />
    </main>
  );
}
