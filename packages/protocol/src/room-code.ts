import { z } from "zod";

/** No 0/O or 1/I, so a code read aloud or off a screen can't be mistyped. 32 symbols, 32⁶ ≈ 1.07B codes. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/**
 * A code as a person types it: case, spaces and dashes don't matter ("ab3 k-9q" → "AB3K9Q").
 * The bound before the transform keeps a pasted essay from being normalised at all.
 */
export const roomCodeInput = z
  .string()
  .max(32)
  .transform((raw) => raw.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(ROOM_CODE, "Room codes are 6 letters and numbers."));
