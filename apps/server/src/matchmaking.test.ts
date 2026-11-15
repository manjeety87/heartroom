import { randomBytes } from "node:crypto";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "@colyseus/sdk";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "./auth/verify-token.ts";
import { createSealer } from "./checkpoint.ts";
import { createLogger } from "./logger.ts";
import { guardMatchmaking } from "./matchmaking.ts";
import { createDbStore } from "./persistence/store.ts";
import { createGameRoom } from "./rooms/GameRoom.ts";
import type { Voice } from "./voice/voice.ts";

/** Its own file: the guard patches the process-wide matchmaker, and limits are per process. */

const PORT = 2656;
const URL = `http://localhost:${String(PORT)}`;
const PER_MINUTE = 6;
let server: Server;
let closeDb: () => Promise<void>;

const voice: Voice = {
  isEnabled: false,
  url: "",
  mintToken: () => Promise.reject(new Error("off")),
  setCanPublish: () => Promise.resolve(),
  remove: () => Promise.resolve(),
};

beforeAll(async () => {
  const opened = await openTestDb();
  closeDb = opened.close;
  const log = createLogger("silent");
  server = defineServer({
    transport: new WebSocketTransport(),
    greet: false,
    rooms: {
      room: defineRoom(
        createGameRoom({
          verifyToken: createTokenVerifier({
            isProduction: false,
            keys: () => Promise.reject(new Error("dev tokens only")),
          }),
          log,
          sealer: createSealer({ current: randomBytes(32) }),
          store: createDbStore(opened.db),
          bootId: "matchmaking-boot",
          voice,
          isVoiceResting: () => false,
          trustProxy: 1,
        }),
      ),
    },
  });
  // Behind one proxy: the last X-Forwarded-For entry is the client.
  guardMatchmaking({ trustProxy: 1, log, perMinute: PER_MINUTE });
  await server.listen(PORT);
}, 30_000);

afterAll(async () => {
  await server.gracefullyShutdown(false);
  await closeDb();
});

const matchmake = (method: string, room: string, from: string) =>
  fetch(`${URL}/matchmake/${method}/${room}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer dev:prober",
      // A made-up first entry, as an attacker would send; the proxy appends the real address.
      "x-forwarded-for": `${String(Math.random())}, ${from}`,
    },
    body: JSON.stringify({ nickname: "Probe" }),
  });

describe("matchmaking", () => {
  it("never puts anyone in a room they don't have the code for", async () => {
    const host = new Client(`ws://localhost:${String(PORT)}`);
    host.auth.token = "dev:host";
    const room = await host.create("room", { nickname: "Hema" });
    for (const method of ["join", "joinOrCreate"]) {
      const answer = await matchmake(method, "room", "198.51.100.1");
      expect(answer.ok).toBe(false);
    }
    await room.leave();
  });

  it("limits code guesses per real client address, whatever the client writes first", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < PER_MINUTE + 2; i++) {
      statuses.push((await matchmake("joinById", "ZZZZZZ", "203.0.113.7")).status);
    }
    expect(statuses.slice(0, PER_MINUTE).every((s) => s !== 429)).toBe(true);
    const refused = await matchmake("joinById", "ZZZZZZ", "203.0.113.7");
    expect(refused.status).toBe(429);
    expect(JSON.stringify(await refused.json())).toContain("RATE_LIMITED");
    // Someone else, behind the same proxy, is not affected.
    expect((await matchmake("joinById", "ZZZZZZ", "203.0.113.8")).status).not.toBe(429);
  });
});
