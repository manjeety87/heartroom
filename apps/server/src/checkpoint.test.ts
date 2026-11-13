import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CHECKPOINT_TTL_MS, chooseRestore, createSealer, type RoomSnapshot } from "./checkpoint.ts";

const NOW = 1_800_000_000_000;
const key = randomBytes(32);
const otherKey = randomBytes(32);

const member = (userId: string, seat: number | null) => ({
  userId,
  nickname: userId,
  color: "indigo" as const,
  seat,
});

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    bootId: "old-boot",
    roomId: "ABCDEF",
    roomUid: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    seq: 4,
    issuedAt: NOW,
    hostId: "asha",
    isLocked: false,
    bans: [],
    gamesStarted: 1,
    phase: "playing",
    members: [member("asha", 0), member("bilal", 1), member("chitra", null)],
    setup: { gameId: "bingo", config: { size: 3 } },
    match: {
      id: "0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a",
      startedAt: NOW - 60_000,
      gameId: "bingo",
      moduleVersion: 1,
      config: { size: 3 },
      seats: 2,
      seed: "AAAA",
      actions: [{ seat: 0, action: { type: "ready" }, by: "player" }],
      users: ["asha", "bilal"],
      players: [
        { userId: "asha", nickname: "Asha", color: "indigo" },
        { userId: "bilal", nickname: "Bilal", color: "coral" },
      ],
    },
    ...overrides,
  };
}

describe("createSealer", () => {
  const sealer = createSealer({ current: key });

  it("when a snapshot is sealed and opened, then it comes back unchanged", () => {
    const blob = sealer.seal(snapshot());
    expect(blob).toMatch(/^c1\.[\w-]+$/);
    expect(sealer.open(blob, NOW + 1_000)).toEqual(snapshot());
  });

  it("when the blob is sealed twice, then it reads differently each time (fresh nonce)", () => {
    expect(sealer.seal(snapshot())).not.toBe(sealer.seal(snapshot()));
  });

  it("does not show the room's contents to whoever holds the blob", () => {
    const blob = sealer.seal(snapshot());
    const bytes = Buffer.from(blob.slice(3), "base64url").toString("latin1");
    expect(bytes).not.toContain("bilal");
    expect(bytes).not.toContain("AAAA");
  });

  it("when any byte is changed, then it refuses the blob", () => {
    const blob = sealer.seal(snapshot());
    const bytes = Buffer.from(blob.slice(3), "base64url");
    for (const index of [0, 20, bytes.length - 1]) {
      const edited = Buffer.from(bytes);
      edited[index] = (edited[index] ?? 0) ^ 1;
      expect(sealer.open(`c1.${edited.toString("base64url")}`, NOW)).toBeNull();
    }
  });

  it("when the blob is malformed or from another format, then it refuses it", () => {
    for (const blob of ["", "c1.", "c2.abc", "c1.abc.def", "nonsense", "c1.AAAA"]) {
      expect(sealer.open(blob, NOW)).toBeNull();
    }
  });

  it("when it was sealed with another key, then it refuses it; the previous key still opens", () => {
    const old = createSealer({ current: otherKey }).seal(snapshot());
    expect(sealer.open(old, NOW)).toBeNull();
    const rotated = createSealer({ current: key, previous: otherKey });
    expect(rotated.open(old, NOW)).toEqual(snapshot());
  });

  it("when it is older than 15 minutes or from the future, then it refuses it", () => {
    const blob = sealer.seal(snapshot());
    expect(sealer.open(blob, NOW + CHECKPOINT_TTL_MS)).not.toBeNull();
    expect(sealer.open(blob, NOW + CHECKPOINT_TTL_MS + 1)).toBeNull();
    expect(sealer.open(blob, NOW - 1)).toBeNull();
  });

  it("refuses a key that isn't 32 bytes", () => {
    expect(() => createSealer({ current: randomBytes(16) })).toThrow(RangeError);
  });
});

describe("chooseRestore", () => {
  const BOOT = "new-boot";

  it("when players hold different checkpoints, then the newest wins", () => {
    const choice = chooseRestore(
      [
        { userId: "asha", snapshot: snapshot({ seq: 7 }) },
        { userId: "bilal", snapshot: snapshot({ seq: 9 }) },
      ],
      BOOT,
    );
    expect(choice).toMatchObject({ snapshot: { seq: 9 }, keepsGame: true });
  });

  it("when a losing player sends an older copy, then it can't roll the game back", () => {
    const choice = chooseRestore(
      [
        { userId: "bilal", snapshot: snapshot({ seq: 3 }) },
        { userId: "asha", snapshot: snapshot({ seq: 12 }) },
      ],
      BOOT,
    );
    expect(choice?.snapshot.seq).toBe(12);
  });

  it("when only one player of the game is back, then the room returns to its lobby", () => {
    expect(chooseRestore([{ userId: "asha", snapshot: snapshot() }], BOOT)).toMatchObject({
      keepsGame: false,
    });
  });

  it("ignores a spectator's or stranger's checkpoint and one from this very process", () => {
    expect(
      chooseRestore(
        [
          { userId: "chitra", snapshot: snapshot({ seq: 99 }) },
          { userId: "zed", snapshot: snapshot({ seq: 99 }) },
          { userId: "asha", snapshot: snapshot({ seq: 99, bootId: BOOT }) },
        ],
        BOOT,
      ),
    ).toBeNull();
  });

  it("when the room was in its lobby, then one seated player is enough", () => {
    const lobby = snapshot({ phase: "lobby", match: null, seq: 0 });
    expect(chooseRestore([{ userId: "bilal", snapshot: lobby }], BOOT)).toMatchObject({
      keepsGame: false,
      snapshot: { phase: "lobby" },
    });
  });
});
