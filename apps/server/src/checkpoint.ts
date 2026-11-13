import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { LIMITS, ROOM_PHASES, SEAT_COLOR_IDS } from "@heartroom/protocol";
import { z } from "zod";

/**
 * Crash recovery, Option A (design doc › Deploys and crashes): after every action the room seals its
 * whole state into one blob and gives the same blob to every player. Browsers can neither read it (no
 * grid or seed leaks) nor change it (GCM rejects any edit). After a restart they hand it back and the
 * room is rebuilt from it.
 *
 * The game itself is kept as `config + seed + actions` and rebuilt by replaying them through the
 * game's own rules, so a checkpoint never stores game state and can't hold one the rules wouldn't
 * produce.
 */

/** Format version, so a future change can refuse (or migrate) an old blob instead of misreading it. */
const FORMAT = "c1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
export const CHECKPOINT_TTL_MS = 15 * 60_000;
/** The room re-seals this often without actions, so a quiet lobby or Chill game stays restorable. */
export const RESEAL_EVERY_MS = 5 * 60_000;

const id = z.string().min(1).max(LIMITS.ID_CHARS);

const memberSnapshot = z.strictObject({
  userId: id,
  nickname: z.string().min(1).max(LIMITS.NICKNAME_CHARS),
  color: z.enum(SEAT_COLOR_IDS),
  seat: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.MAX_SEATS - 1)
    .nullable(),
});

const matchSnapshot = z.strictObject({
  gameId: id,
  /** The game module's `version`; a server running another version refuses the checkpoint. */
  moduleVersion: z.number().int(),
  config: z.unknown(),
  seats: z.number().int().min(1).max(LIMITS.MAX_SEATS),
  /** base64url of the match seed. */
  seed: z.string().min(1).max(64),
  actions: z
    .array(
      z.strictObject({
        seat: z.number().int().min(0),
        action: z.unknown(),
        by: z.enum(["player", "server"]),
      }),
    )
    .max(2_000),
  /** userId per game seat. */
  users: z.array(id).max(LIMITS.MAX_SEATS),
  players: z
    .array(z.strictObject({ userId: id, nickname: z.string(), color: z.enum(SEAT_COLOR_IDS) }))
    .max(LIMITS.MAX_SEATS),
});

export const snapshotSchema = z.strictObject({
  /** Which server process sealed it; a checkpoint from the running process is never restored. */
  bootId: id,
  roomId: z.string().length(6),
  /**
   * Counts every change to the room since it was created (not the game's own seq, which restarts
   * each game); the highest wins when players hold different checkpoints.
   */
  seq: z.number().int().nonnegative(),
  issuedAt: z.number().int().nonnegative(),
  hostId: id,
  isLocked: z.boolean(),
  bans: z.array(id).max(LIMITS.MAX_SEATS + LIMITS.MAX_SPECTATORS),
  gamesStarted: z.number().int().nonnegative(),
  phase: z.enum(ROOM_PHASES),
  members: z.array(memberSnapshot).max(LIMITS.MAX_SEATS + LIMITS.MAX_SPECTATORS),
  /** The host's chosen game and config, for the next Start. */
  setup: z.strictObject({ gameId: id, config: z.unknown() }).nullable(),
  match: matchSnapshot.nullable(),
});

export type RoomSnapshot = z.infer<typeof snapshotSchema>;
export type MatchSnapshot = z.infer<typeof matchSnapshot>;

/** `CHECKPOINT_KEY` (and the previous one during a rotation): 32 raw bytes each. */
export type CheckpointKeys = { readonly current: Buffer; readonly previous?: Buffer | undefined };

export type Sealer = {
  seal(snapshot: RoomSnapshot): string;
  /** The snapshot, or null when the blob is malformed, edited, sealed with another key, or expired. */
  open(blob: string, now: number): RoomSnapshot | null;
};

export function createSealer(keys: CheckpointKeys): Sealer {
  for (const key of [keys.current, keys.previous]) {
    if (key !== undefined && key.length !== 32)
      throw new RangeError("checkpoint keys are 32 bytes");
  }
  const decrypt = (key: Buffer, nonce: Buffer, body: Buffer, tag: Buffer): string | null => {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(Buffer.from(FORMAT));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  };

  return {
    seal(snapshot) {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv("aes-256-gcm", keys.current, nonce);
      cipher.setAAD(Buffer.from(FORMAT));
      const body = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
      const sealed = Buffer.concat([nonce, body, cipher.getAuthTag()]);
      return `${FORMAT}.${sealed.toString("base64url")}`;
    },
    open(blob, now) {
      if (blob.length > LIMITS.CHECKPOINT_CHARS) return null;
      const [format, payload, ...rest] = blob.split(".");
      if (format !== FORMAT || payload === undefined || rest.length > 0) return null;
      const sealed = Buffer.from(payload, "base64url");
      if (sealed.length <= NONCE_BYTES + TAG_BYTES) return null;
      const nonce = sealed.subarray(0, NONCE_BYTES);
      const body = sealed.subarray(NONCE_BYTES, sealed.length - TAG_BYTES);
      const tag = sealed.subarray(sealed.length - TAG_BYTES);
      const text =
        decrypt(keys.current, nonce, body, tag) ??
        (keys.previous === undefined ? null : decrypt(keys.previous, nonce, body, tag));
      if (text === null) return null;
      let parsed: ReturnType<typeof snapshotSchema.safeParse>;
      try {
        parsed = snapshotSchema.safeParse(JSON.parse(text));
      } catch {
        return null;
      }
      if (!parsed.success) return null;
      const age = now - parsed.data.issuedAt;
      return age < 0 || age > CHECKPOINT_TTL_MS ? null : parsed.data;
    },
  };
}

/** A checkpoint a player sent back, already opened. */
export type Resume = { readonly userId: string; readonly snapshot: RoomSnapshot };

/**
 * Which state a room comes back as, from the checkpoints its players sent (design doc › Restoring
 * safely). Only players seated in a checkpoint count, so a spectator or stranger can't steer it; the
 * newest (`seq`) wins, so one player's old copy can't undo a later move; and a game in progress comes
 * back only if at least two of its players are back, otherwise the room returns to its lobby.
 * Null when nothing usable was sent (every checkpoint from this very process, or from non-players).
 */
export function chooseRestore(
  resumes: readonly Resume[],
  ownBootId: string,
): { readonly snapshot: RoomSnapshot; readonly keepsGame: boolean } | null {
  const valid = resumes.filter(
    ({ userId, snapshot }) =>
      snapshot.bootId !== ownBootId &&
      snapshot.members.some((m) => m.userId === userId && m.seat !== null),
  );
  const newest = valid.reduce<Resume | null>(
    (best, resume) =>
      best === null ||
      resume.snapshot.seq > best.snapshot.seq ||
      (resume.snapshot.seq === best.snapshot.seq &&
        resume.snapshot.issuedAt > best.snapshot.issuedAt)
        ? resume
        : best,
    null,
  );
  if (newest === null) return null;
  const { snapshot } = newest;
  if (snapshot.match === null || snapshot.phase !== "playing")
    return { snapshot, keepsGame: false };
  const players = new Set(snapshot.match.users);
  const back = new Set(valid.map((r) => r.userId).filter((userId) => players.has(userId)));
  return { snapshot, keepsGame: back.size >= 2 };
}
