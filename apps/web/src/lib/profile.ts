"use client";

import { z } from "zod";
import { nicknameInput } from "@heartroom/protocol";
import { SEAT_COLORS, type SeatColorId } from "@heartroom/ui";
import { useStored, writeStored } from "./stored.ts";

/**
 * Who you are on this device until accounts arrive (Phase 4): a name and a player colour, plus
 * sound and haptics. The name rules are the shared `nicknameInput`, so rooms will accept it too.
 */

const KEY = "heartroom.profile.v1";

const colorIds = SEAT_COLORS.map((c) => c.id) as [SeatColorId, ...SeatColorId[]];

const profileSchema = z.object({
  name: nicknameInput.nullable(),
  color: z.enum(colorIds),
  sound: z.boolean(),
  haptics: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;

const DEFAULT_PROFILE: Profile = { name: null, color: "indigo", sound: true, haptics: true };

/** Names the computer already uses, so a player can't be confused with it. */
export const RESERVED_NAMES = ["computer"] as const;

export const useProfile = (): Profile => useStored(KEY, profileSchema, DEFAULT_PROFILE);

export function saveProfile(profile: Profile): void {
  writeStored(KEY, profile);
}

/** Checks a typed name; returns the clean name or a message to show under the field. */
export function checkName(
  input: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const parsed = nicknameInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Try another name." };
  if ((RESERVED_NAMES as readonly string[]).includes(parsed.data.toLowerCase())) {
    return { ok: false, message: "That’s the computer’s name. Pick another." };
  }
  return { ok: true, name: parsed.data };
}

/** The computer takes the first colour the player didn't pick. */
export function computerColor(player: SeatColorId): SeatColorId {
  return SEAT_COLORS.find((c) => c.id !== player)?.id ?? "coral";
}
