"use client";

import { useRouter } from "next/navigation";
import { NameStep } from "@/features/room/NameStep";
import { joinFailureCopy } from "@/features/room/copy";
import { rememberFirstGame } from "@/features/room/first-game";
import { useProfile } from "@/lib/profile";
import { enterRoom } from "@/lib/room-client/client";
import type { GameId } from "./catalog.ts";

/** Your name, then a room that already has this game picked; you land in its lobby with the code. */
export function StartRoom({ gameId }: { readonly gameId: GameId }) {
  const router = useRouter();
  const profile = useProfile();
  return (
    <NameStep
      submitLabel="Create room"
      onSubmit={async (nickname) => {
        const result = await enterRoom(null, { nickname, color: profile.color });
        if (!result.ok) return joinFailureCopy(result.failure);
        rememberFirstGame(result.code, gameId);
        router.push(`/r/${result.code}`);
        return null;
      }}
    />
  );
}
