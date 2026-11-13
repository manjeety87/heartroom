import { randomBytes } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@heartroom/protocol";

/** With ~1B codes and a few hundred live rooms, needing even a second try is rare; ten is never. */
const MAX_ATTEMPTS = 10;
const LINK_TOKEN_BYTES = 16;

type RandomBytes = (size: number) => Uint8Array;

/**
 * A fresh 6-character room code not in use by a live room. Each byte is masked to 0–31; the alphabet
 * has exactly 32 symbols, so every symbol is equally likely (no modulo bias).
 */
export function newRoomCode(
  isTaken: (code: string) => boolean,
  random: RandomBytes = randomBytes,
): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = Array.from(
      random(ROOM_CODE_LENGTH),
      (byte) => ROOM_CODE_ALPHABET[byte & 31] as string,
    ).join("");
    if (!isTaken(code)) return code;
  }
  throw new Error(`No free room code after ${MAX_ATTEMPTS} attempts`);
}

/** The secret in a share link: 128 bits, so it can't be guessed the way a 6-character code can. */
export function newLinkToken(random: RandomBytes = randomBytes): string {
  return Buffer.from(random(LINK_TOKEN_BYTES)).toString("base64url");
}
