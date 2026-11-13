"use client";

import { Client, type Room } from "@colyseus/sdk";
import {
  joinError,
  SEAT_COLOR_IDS,
  serverMessage,
  type HostMessage,
  type JoinOptions,
} from "@heartroom/protocol";
import { z } from "zod";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { ensureGuest, getGameToken } from "@/lib/auth/client";
import { newId } from "@/lib/id";
import {
  applyServerMessage,
  closedReasonFor,
  INITIAL_STATE,
  type JoinFailure,
  type RoomState,
} from "./state.ts";

/**
 * The only code that talks to the game server (frontend.md › Realtime client patterns). One room at
 * a time per tab. Screens call `enterRoom`, `sendIntent`, `sendHost` and `leaveRoom`, and read the
 * state through `useRoom(selector)`. It lives at module level so moving from "Create room" to
 * `/r/CODE` keeps the connection.
 */

const store = createStore<RoomState>(() => INITIAL_STATE);

export const useRoom = <T>(selector: (state: RoomState) => T): T => useStore(store, selector);

let room: Room | null = null;
let isLeaving = false;
/** The open "Join voice" request: answered by a voice_token, or by VOICE_UNAVAILABLE. */
let voiceRequest: ((answer: VoiceAnswer) => void) | null = null;

export type VoiceAnswer = { readonly token: string; readonly url: string } | null;

/** Development serves the game server on port 2567 of the same machine, LAN phones included. */
function serverUrl(): string {
  const configured = process.env["NEXT_PUBLIC_GAME_SERVER_URL"];
  if (configured) return configured;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.hostname}:2567`;
}

// ── refresh: rejoin the same room as the same person ────────────────────────────────────────────

const LAST_ROOM_KEY = "heartroom.room.v1";
const lastRoomSchema = z.object({
  code: z.string(),
  nickname: z.string(),
  color: z.enum(SEAT_COLOR_IDS).optional(),
  /** The room's newest checkpoint, so even a refresh after a server restart brings the game back. */
  resume: z.string().optional(),
});

/** The room this tab is in, so a refresh rejoins it (the server gives the same user their seat). */
export function lastRoomFor(code: string): JoinOptions | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_ROOM_KEY);
    const parsed = lastRoomSchema.safeParse(raw === null ? null : JSON.parse(raw));
    if (!parsed.success || parsed.data.code !== code) return null;
    const { nickname, color, resume } = parsed.data;
    return { nickname, ...(color && { color }), ...(resume !== undefined && { resume }) };
  } catch {
    return null;
  }
}

function rememberRoom(code: string | null, options?: JoinOptions) {
  try {
    if (code === null) window.sessionStorage.removeItem(LAST_ROOM_KEY);
    else window.sessionStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ code, ...options }));
  } catch {
    // Storage blocked: a refresh then shows the join form instead of rejoining.
  }
}

// ── joining ──────────────────────────────────────────────────────────────────────────────────

function failureFrom(error: unknown): JoinFailure {
  const text = error instanceof Error ? error.message : "";
  try {
    const parsed = joinError.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
  } catch {
    // Not one of our refusals: Colyseus's own text, or the network.
  }
  // Colyseus answers an unknown room id itself, before our `onAuth` runs.
  if (/not found|no rooms found/i.test(text)) {
    return { code: "ROOM_NOT_FOUND", message: "That room doesn’t exist or has closed." };
  }
  return { code: "UNREACHABLE", message: "Can’t reach the game server." };
}

/**
 * With a checkpoint the room may have been lost in a restart: join it if it is there (alive, or being
 * rebuilt from someone else's checkpoint), otherwise bring it back; if another player beat us to
 * that, join theirs.
 */
async function connect(client: Client, target: string | null, options: JoinOptions) {
  if (target === null) return client.create("room", options);
  if (options.resume === undefined) return client.joinById(target, options);
  try {
    return await client.joinById(target, options);
  } catch (error) {
    if (failureFrom(error).code !== "ROOM_NOT_FOUND") throw error;
  }
  try {
    return await client.create("room", options);
  } catch (error) {
    if (failureFrom(error).code !== "ROOM_RESTORING") throw error;
  }
  return client.joinById(target, options);
}

/** A restart is a few seconds of downtime; spread everyone's return over 2–5 s. */
const resumeDelayMs = () => 2_000 + Math.random() * 3_000;

/**
 * Creates a room (`target` null) or joins one by code. Resolves to the room code, or to why it
 * failed; never throws. A second call while connected to the same room is a no-op.
 */
export async function enterRoom(
  target: string | null,
  options: JoinOptions,
  status: "connecting" | "resuming" = "connecting",
): Promise<{ ok: true; code: string } | { ok: false; failure: JoinFailure }> {
  const current = store.getState();
  if (room !== null && target === room.roomId && current.status !== "closed") {
    return { ok: true, code: room.roomId };
  }
  if (room !== null) await leaveRoom();
  store.setState({ ...INITIAL_STATE, status, isRestoring: status === "resuming" });

  let joined: Room;
  let me: string;
  try {
    me = (await ensureGuest()).id;
    const client = new Client(serverUrl());
    client.auth.token = await getGameToken();
    joined = await connect(client, target, options);
  } catch (error) {
    rememberRoom(null);
    store.setState({ ...INITIAL_STATE });
    return { ok: false, failure: failureFrom(error) };
  }

  room = joined;
  isLeaving = false;
  // Colyseus's own retry, from the first second: a phone that blinks off Wi-Fi comes straight back.
  // About 15 s of tries; after that the checkpoint path below rejoins (or rebuilds after a crash).
  joined.reconnection.minUptime = 0;
  joined.reconnection.maxRetries = 8;
  joined.reconnection.maxDelay = 5_000;

  joined.onMessage("*", (_type, payload: unknown) => {
    const parsed = serverMessage.safeParse(payload);
    if (!parsed.success) return; // Dropped: an older or newer server speaking another shape.
    store.setState((state) => applyServerMessage(state, parsed.data, Date.now()));
    if (parsed.data.type === "voice_token") answerVoice(parsed.data);
    if (parsed.data.type === "error" && parsed.data.code === "VOICE_UNAVAILABLE") answerVoice(null);
    if (parsed.data.type === "checkpoint") {
      rememberRoom(joined.roomId, { ...options, resume: parsed.data.checkpoint });
    }
  });
  joined.onDrop(() => {
    store.setState({ status: "reconnecting" });
  });
  joined.onReconnect(() => {
    store.setState({ status: "live" });
    // Anything not acknowledged before the drop goes again; the server acks a repeat without replaying it.
    for (const pending of store.getState().outbox)
      joined.send("intent", { type: "intent", ...pending });
  });
  joined.onLeave((code) => {
    if (room === joined) room = null;
    const reason = closedReasonFor(code, isLeaving);
    const { checkpoint } = store.getState();
    if ((reason === "restarting" || reason === "lost") && checkpoint !== null) {
      store.setState({ status: "resuming", outbox: [] });
      window.setTimeout(() => {
        void enterRoom(joined.roomId, { ...options, resume: checkpoint }, "resuming").then(
          (result) => {
            if (result.ok) return;
            // A refused checkpoint means the room is gone for good (closed, or too old).
            const closed = result.failure.code === "CHECKPOINT_REJECTED" ? "room_closed" : "lost";
            store.setState({ status: "closed", closed });
          },
        );
      }, resumeDelayMs());
      return;
    }
    if (reason !== "lost" && reason !== "restarting") rememberRoom(null);
    store.setState({ status: "closed", closed: reason, outbox: [] });
  });

  rememberRoom(joined.roomId, options);
  store.setState({ status: "live", me });
  return { ok: true, code: joined.roomId };
}

// ── sending ─────────────────────────────────────────────────────────────────────────────────

/** A game move, made from the view the player is looking at. Ignored while not connected. */
export function sendIntent(action: unknown): void {
  const { status, game, outbox } = store.getState();
  if (room === null || status !== "live" || game === null) return;
  const pending = { clientActionId: newId(), turnSeq: game.seq, action };
  store.setState({ outbox: [...outbox, pending] });
  room.send("intent", { type: "intent", ...pending });
}

export function sendHost(command: HostMessage): void {
  if (room === null || store.getState().status !== "live") return;
  room.send("host", command);
}

function answerVoice(answer: VoiceAnswer) {
  voiceRequest?.(answer);
  voiceRequest = null;
}

/**
 * Asks the room for a LiveKit token. Null when voice is unavailable, the room isn't connected, or no
 * answer comes in 10 s (a token request never waits on the game).
 */
export function requestVoiceToken(): Promise<VoiceAnswer> {
  if (room === null || store.getState().status !== "live") return Promise.resolve(null);
  answerVoice(null); // only one request at a time; a newer tap replaces an older one
  const asking = room;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      answerVoice(null);
    }, 10_000);
    voiceRequest = (answer) => {
      window.clearTimeout(timer);
      resolve(answer);
    };
    asking.send("voice_token", { type: "voice_token" });
  });
}

/** Leaves on purpose: the seat is given up at once and a refresh won't rejoin. */
export async function leaveRoom(): Promise<void> {
  rememberRoom(null);
  const leaving = room;
  room = null;
  if (leaving !== null) {
    isLeaving = true;
    await leaving.leave(true);
  }
  store.setState({ ...INITIAL_STATE });
}
