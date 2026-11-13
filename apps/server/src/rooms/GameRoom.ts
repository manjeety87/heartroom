import { randomUUID } from "node:crypto";
import { Room, ServerError, type AuthContext, type Client } from "@colyseus/core";
import { newSeed, type Viewer } from "@heartroom/engine";
import {
  CLOSE_CODES,
  ERROR_MESSAGES,
  LIMITS,
  clientMessage,
  joinOptions,
  type DeadlineMessage,
  type ErrorCode,
  type HostMessage,
  type JoinError,
  type RoomMessage,
  type RoomPhase,
  type SeatColorId,
} from "@heartroom/protocol";
import type { VerifyToken } from "../auth/verify-token.ts";
import {
  chooseRestore,
  RESEAL_EVERY_MS,
  type MatchSnapshot,
  type Resume,
  type RoomSnapshot,
  type Sealer,
} from "../checkpoint.ts";
import type { Logger } from "../logger.ts";
import type { MatchToRecord, RoomEventType, RoomStore } from "../persistence/store.ts";
import { newRoomCode } from "./codes.ts";
import { msUntilDue, trackDeadline, type DeadlineClock } from "./deadline.ts";
import { prepareMatch, type Match, type MatchSetup } from "./match.ts";
import { freeSeat, nameSuggestion, nextHost, pickColor, type Member } from "./members.ts";
import { createQueue, type Queue } from "./queue.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { GAMES, isGameId } from "./registry.ts";
import type { Voice } from "../voice/voice.ts";
import { voiceGuards } from "../voice/webhooks.ts";

export type GameRoomDeps = {
  readonly verifyToken: VerifyToken;
  readonly log: Logger;
  /** Seals and opens crash-recovery checkpoints (`CHECKPOINT_KEY`). */
  readonly sealer: Sealer;
  /** This process's id: a checkpoint sealed by it is never "restored". */
  readonly bootId: string;
  /** Matches and room events in Postgres. Never awaited by game play (only by a restore). */
  readonly store: RoomStore;
  /** LiveKit tokens and permissions; disabled when voice isn't configured. */
  readonly voice: Voice;
  /** True once this month's voice minutes reach the cap: new voice tokens are refused. */
  readonly isVoiceResting: () => boolean;
  /** Tests shorten this; production uses `SPECTATOR_VOICE_IDLE_MS`. */
  readonly spectatorVoiceIdleMs?: number;
};

/** A spectator whose room tab has been hidden this long leaves voice (design doc › Voice). */
export const SPECTATOR_VOICE_IDLE_MS = 3 * 60_000;

/** Seconds a dropped player keeps their place (design doc › GameRoom › Reconnect). */
const RECONNECT_SECONDS = 60;
/** Duplicate intents are re-acknowledged, not re-applied, within this many recent ids. */
const RECENT_ACTION_IDS = 50;
const MINUTE = 60_000;
/** How long a room rebuilt after a restart waits for its players' checkpoints (design doc rule 2). */
const RESTORE_WINDOW_MS = 5_000;

/** Codes of rooms alive in this process; one process, so this is the whole world. */
const liveCodes = new Set<string>();

// Per IP / per user across all rooms (docs/engineering/backend.md › Security checklist).
const joinPerIp = createRateLimiter({ capacity: 10, windowMs: MINUTE });
const createPerIp = createRateLimiter({ capacity: 20, windowMs: MINUTE });
const createPerUser = createRateLimiter({ capacity: 5, windowMs: MINUTE });
// Joining voice is a tap; a client asking more often than this is looping.
const voiceTokensPerUser = createRateLimiter({ capacity: 10, windowMs: MINUTE });

type JoinTicket = {
  readonly userId: string;
  readonly nickname: string;
  readonly color?: SeatColorId;
};

function refuse(status: number, code: ErrorCode, suggestion?: string): never {
  const body: JoinError = {
    code,
    message: ERROR_MESSAGES[code],
    ...(suggestion && { suggestion }),
  };
  throw new ServerError(status, JSON.stringify(body));
}

/**
 * The room class is built per server so it can hold config and the logger: Colyseus constructs rooms
 * itself, and create/join options come from the browser, so they can't carry either.
 */
export function createGameRoom(deps: GameRoomDeps) {
  return class GameRoom extends Room {
    override maxClients = LIMITS.MAX_SEATS + LIMITS.MAX_SPECTATORS;
    // Colyseus closes a socket above this; a real player never comes close.
    override maxMessagesPerSecond = 20;

    private log: Logger = deps.log;
    private readonly members = new Map<string, Member>();
    private readonly tickets = new Map<string, JoinTicket>();
    private readonly bans = new Set<string>();
    /** Kept in room state (and checkpoints) so every new voice token also says canPublish: false. */
    private readonly micBlocked = new Set<string>();
    /** People whose room tab is hidden; with the spectators' voice timers. */
    private readonly hidden = new Map<string, { clear(): void } | null>();
    private readonly invalidMessages = createRateLimiter({ capacity: 10, windowMs: MINUTE });
    private readonly recentActionIds: string[] = [];
    private queue!: Queue;
    private hostId: string | null = null;
    private isLocked = false;
    private phase: RoomPhase = "lobby";
    private setup: MatchSetup | null = null;
    private match: Match | null = null;
    /** `matchUsers[seat]` = the userId playing match seat `seat`. */
    private matchUsers: string[] = [];
    /** Name and colour per match seat, kept for results after a player leaves. */
    private matchPlayers: NonNullable<RoomMessage["matchPlayers"]> = [];
    private gamesStarted = 0;
    private deadlineClock: DeadlineClock | null = null;
    private deadlineTimer: { clear(): void } | null = null;
    /** The setup the current/last match was started with (the host may change `setup` afterwards). */
    private matchSetup: MatchSetup | null = null;
    /** The current/last match's row id in `matches`, and when it started. */
    private matchId = "";
    private matchStartedAt = 0;
    /** The room's own id for `room_events` (its code is reused once it closes). */
    private roomUid: string = randomUUID();
    /** Set by a deploy/Ctrl+C: closing then is not "closed on purpose", players will resume. */
    private isShuttingDown = false;
    /** Bumped on every sealed checkpoint; orders checkpoints across games. */
    private checkpointSeq = 0;
    private isCheckpointDue = false;
    /** While the room is being rebuilt after a restart: the checkpoints and sockets gathered so far. */
    private restoring: {
      readonly resumes: Resume[];
      readonly sessions: Map<string, string>;
      readonly timer: { clear(): void };
    } | null = null;

    override onCreate(rawOptions: unknown) {
      const resume = joinOptions.safeParse(rawOptions).data?.resume;
      if (resume === undefined) {
        this.roomId = newRoomCode((code) => liveCodes.has(code));
      } else {
        // A browser bringing back a room lost in a restart. Its checkpoint names the code.
        const snapshot = deps.sealer.open(resume, Date.now());
        if (snapshot === null || snapshot.bootId === deps.bootId)
          refuse(410, "CHECKPOINT_REJECTED");
        // Someone else brought it back first: the browser joins that room instead.
        if (liveCodes.has(snapshot.roomId)) refuse(409, "ROOM_RESTORING");
        this.roomId = snapshot.roomId;
        this.roomUid = snapshot.roomUid;
        this.restoring = {
          resumes: [],
          sessions: new Map(),
          timer: this.clock.setTimeout(() => {
            void this.queue.enqueue(() => this.finishRestore());
          }, RESTORE_WINDOW_MS),
        };
      }
      liveCodes.add(this.roomId);
      this.registerVoiceGuard();
      this.log = deps.log.child({ roomId: this.roomId });
      if (this.restoring === null) this.saveEvent("created");
      // Even with no moves, a fresh checkpoint every few minutes keeps a quiet room restorable.
      this.clock.setInterval(() => {
        this.markChanged();
      }, RESEAL_EVERY_MS);
      this.queue = createQueue((error) => {
        this.log.error({ event: "room_task_failed", err: error }, "room_task_failed");
      });
      this.onMessage("*", (client, type, payload) => {
        this.onClientMessage(client, type, payload);
      });
      this.log.info({ event: "room_created" }, "room_created");
    }

    override async onAuth(client: Client, rawOptions: unknown, context: AuthContext) {
      const identity = await deps.verifyToken(context.token);
      if (identity === null) refuse(401, "UNAUTHORIZED");
      const { userId } = identity;
      const ip = context.ip ?? "unknown";
      const isCreating = this.hostId === null && this.members.size === 0;
      const isAllowed = isCreating
        ? createPerIp.take(ip) && createPerUser.take(userId)
        : joinPerIp.take(ip);
      if (!isAllowed) refuse(429, "RATE_LIMITED");

      const options = joinOptions.safeParse(rawOptions);
      if (!options.success) refuse(400, "INVALID_MESSAGE");
      if (this.restoring !== null) {
        // Only people from this room, holding its checkpoint, while it is being rebuilt.
        const { resume } = options.data;
        const snapshot = resume === undefined ? null : deps.sealer.open(resume, Date.now());
        if (snapshot === null) refuse(503, "ROOM_RESTORING");
        const isMember = snapshot.members.some((m) => m.userId === userId);
        if (snapshot.roomId !== this.roomId || !isMember) refuse(503, "ROOM_RESTORING");
        this.restoring.resumes.push({ userId, snapshot });
        this.tickets.set(client.sessionId, { userId, nickname: options.data.nickname });
        return true;
      }
      if (this.bans.has(userId)) refuse(403, "BANNED");
      // A member coming back (refresh, second tab) gets in even when the host has locked the room.
      if (this.isLocked && !this.members.has(userId)) refuse(403, "ROOM_LOCKED");
      const { nickname, color } = options.data;
      const suggestion = nameSuggestion(nickname, userId, [...this.members.values()]);
      if (suggestion !== null) refuse(409, "NAME_TAKEN", suggestion);

      this.tickets.set(client.sessionId, { userId, nickname, ...(color && { color }) });
      return true;
    }

    override onJoin(client: Client) {
      const ticket = this.tickets.get(client.sessionId);
      this.tickets.delete(client.sessionId);
      if (ticket === undefined) throw new Error("joined without passing onAuth");
      const { userId } = ticket;
      if (this.restoring !== null) {
        this.restoring.sessions.set(client.sessionId, userId);
        if (this.everyoneBack()) {
          void this.queue.enqueue(() => this.finishRestore());
        }
        return;
      }
      const existing = this.members.get(userId);

      if (existing === undefined) {
        const others = [...this.members.values()];
        this.members.set(userId, {
          userId,
          nickname: ticket.nickname,
          color: pickColor(ticket.color, userId, others),
          seat: this.phase === "lobby" ? freeSeat(others, LIMITS.MAX_SEATS) : null,
          sessionId: client.sessionId,
          isConnected: true,
        });
      } else {
        // Same person, new socket: the newest one wins and the old one is closed.
        const previous = this.clients.get(existing.sessionId);
        this.members.set(userId, {
          ...existing,
          nickname: ticket.nickname,
          sessionId: client.sessionId,
          isConnected: true,
        });
        previous?.leave(CLOSE_CODES.TAKEN_OVER);
        this.log.info({ event: "taken_over", userId }, "taken_over");
      }
      this.hostId ??= userId;
      // A new socket starts on screen; it says otherwise if its tab is hidden.
      this.setVisible(userId);
      this.log.info({ event: "joined", userId }, "joined");
      this.afterPresenceChange();
      this.sendView(client);
    }

    override async onDrop(client: Client) {
      this.setConnected(client, false);
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
      } catch {
        // Time ran out or the room is closing; onLeave decides what happens to the seat.
      }
    }

    override onReconnect(client: Client) {
      const member = this.memberOf(client);
      if (member === undefined) {
        // Someone took this seat over while the old socket was away.
        client.leave(CLOSE_CODES.TAKEN_OVER);
        return;
      }
      this.setVisible(member.userId);
      this.setConnected(client, true);
      this.sendView(client);
    }

    override onLeave(client: Client) {
      if (this.restoring?.sessions.delete(client.sessionId) === true) return;
      const member = this.memberOf(client);
      if (member === undefined) return; // an old socket closed after a takeover
      const isInMatch = this.phase === "playing" && this.matchUsers.includes(member.userId);
      if (isInMatch) {
        // The seat stays; its deadlines run and the server plays it until they come back.
        this.members.set(member.userId, { ...member, isConnected: false });
      } else {
        this.members.delete(member.userId);
        // Out of the room means out of its voice too, even if the browser didn't say goodbye.
        void deps.voice.remove(this.roomUid, member.userId);
      }
      if (this.hostId === member.userId) {
        this.hostId = nextHost([...this.members.values()], member.userId) ?? this.hostId;
      }
      this.setVisible(member.userId);
      this.log.info({ event: "left", userId: member.userId }, "left");
      this.afterPresenceChange();
    }

    /** A deploy or Ctrl+C: every browser is told to come back with its checkpoint. */
    override onBeforeShutdown() {
      this.isShuttingDown = true;
      void this.disconnect(CLOSE_CODES.RESTARTING);
    }

    override onDispose() {
      liveCodes.delete(this.roomId);
      voiceGuards.unregister(this.roomUid);
      this.deadlineTimer?.clear();
      // Everyone left: the room is over, so a checkpoint someone still holds must not revive it.
      if (!this.isShuttingDown) this.saveEvent("closed", { reason: "empty" });
      this.log.info({ event: "room_closed" }, "room_closed");
    }

    override onUncaughtException(error: Error, methodName: string) {
      this.log.error({ event: "room_exception", method: methodName, err: error }, "room_exception");
    }

    // ── messages ──────────────────────────────────────────────────────────────────────────────

    private onClientMessage(client: Client, type: string | number, payload: unknown) {
      const parsed = clientMessage.safeParse(payload);
      if (!parsed.success || parsed.data.type !== type) {
        this.log.debug({ event: "invalid_message", type }, "invalid_message");
        if (!this.invalidMessages.take(client.sessionId)) {
          client.leave(CLOSE_CODES.INVALID_MESSAGES);
          return;
        }
        this.sendError(client, "INVALID_MESSAGE");
        return;
      }
      const message = parsed.data;
      switch (message.type) {
        case "intent":
          void this.queue.enqueue(() => {
            this.onIntent(client, message.clientActionId, message.turnSeq, message.action);
          });
          return;
        case "resync":
          this.sendView(client);
          return;
        case "host":
          void this.queue.enqueue(() => {
            this.onHostCommand(client, message);
          });
          return;
        case "voice_token":
          void this.onVoiceToken(client);
          return;
        case "presence":
          void this.queue.enqueue(() => {
            this.onPresence(client, message.isVisible);
          });
          return;
        case "rematch_ready":
          this.sendError(client, "NOT_AVAILABLE_YET");
          return;
      }
    }

    private onIntent(client: Client, clientActionId: string, turnSeq: number, action: unknown) {
      const member = this.memberOf(client);
      const seat = member === undefined ? -1 : this.matchUsers.indexOf(member.userId);
      if (this.match === null || this.phase !== "playing" || member === undefined || seat < 0) {
        this.sendError(client, "RULE_VIOLATION");
        return;
      }
      const actionKey = `${member.userId}:${clientActionId}`;
      if (this.recentActionIds.includes(actionKey)) {
        client.send("ack", { type: "ack", clientActionId });
        return;
      }
      if (this.match.isStale(turnSeq)) {
        this.sendError(client, "STALE_TURN");
        this.sendView(client);
        return;
      }
      const outcome = this.match.play(seat, action);
      if (!outcome.ok) {
        this.sendError(client, outcome.code);
        return;
      }
      this.recentActionIds.push(actionKey);
      if (this.recentActionIds.length > RECENT_ACTION_IDS) this.recentActionIds.shift();
      client.send("ack", { type: "ack", clientActionId });
      this.afterMove();
    }

    private onHostCommand(client: Client, command: HostMessage) {
      if (this.memberOf(client)?.userId !== this.hostId) {
        this.sendError(client, "RULE_VIOLATION");
        return;
      }
      const isBetweenGames = this.phase === "lobby" || this.phase === "results";
      switch (command.kind) {
        case "config": {
          if (!isBetweenGames || !isGameId(command.gameId)) {
            this.sendError(client, "RULE_VIOLATION");
            return;
          }
          const setup = prepareMatch(GAMES[command.gameId], command.config);
          if (setup === null) {
            this.sendError(client, "INVALID_MESSAGE");
            return;
          }
          this.setup = setup;
          this.broadcastRoom();
          return;
        }
        case "start":
          if (!isBetweenGames || !this.startMatch()) this.sendError(client, "RULE_VIOLATION");
          return;
        case "lock":
        case "unlock":
          this.isLocked = command.kind === "lock";
          this.broadcastRoom();
          return;
        case "kick": {
          const target = this.members.get(command.target);
          if (target === undefined || target.userId === this.hostId) {
            this.sendError(client, "RULE_VIOLATION");
            return;
          }
          this.bans.add(target.userId);
          this.micBlocked.delete(target.userId);
          this.clients.get(target.sessionId)?.leave(CLOSE_CODES.KICKED);
          void deps.voice.remove(this.roomUid, target.userId);
          this.saveEvent("kicked", { userId: target.userId });
          this.log.info({ event: "kicked", userId: target.userId }, "kicked");
          return;
        }
        case "block_mic":
        case "unblock_mic": {
          const target = this.members.get(command.target);
          if (target === undefined || target.userId === this.hostId) {
            this.sendError(client, "RULE_VIOLATION");
            return;
          }
          const isBlocked = command.kind === "block_mic";
          if (isBlocked) this.micBlocked.add(target.userId);
          else this.micBlocked.delete(target.userId);
          // Enforced by LiveKit, not only the UI: a modified client still can't publish.
          void deps.voice.setCanPublish(this.roomUid, target.userId, !isBlocked);
          this.saveEvent(isBlocked ? "mic_blocked" : "mic_unblocked", { userId: target.userId });
          this.broadcastRoom();
          return;
        }
        case "new_code":
        case "mute":
        case "accept_knock":
        case "deny_knock":
          this.sendError(client, "NOT_AVAILABLE_YET");
          return;
      }
    }

    // ── voice ─────────────────────────────────────────────────────────────────────────────────

    /**
     * A short LiveKit token for this person in this room; voice never blocks the game. Every refusal
     * is VOICE_UNAVAILABLE or VOICE_RESTING, so the browser can tell it from a refused move.
     */
    private async onVoiceToken(client: Client) {
      const member = this.memberOf(client);
      if (
        member === undefined ||
        this.restoring !== null ||
        !deps.voice.isEnabled ||
        !voiceTokensPerUser.take(member.userId)
      ) {
        this.sendError(client, "VOICE_UNAVAILABLE");
        return;
      }
      if (deps.isVoiceResting()) {
        this.sendError(client, "VOICE_RESTING");
        return;
      }
      try {
        const token = await deps.voice.mintToken({
          room: this.roomUid,
          identity: member.userId,
          name: member.nickname,
          canPublish: !this.micBlocked.has(member.userId),
        });
        client.send("voice_token", { type: "voice_token", token, url: deps.voice.url });
      } catch (error) {
        this.log.warn({ event: "voice_token_failed", err: error }, "voice_token_failed");
        this.sendError(client, "VOICE_UNAVAILABLE");
      }
    }

    /**
     * Lets LiveKit webhooks ask this room about someone joining its voice: anyone not in the room
     * (left, kicked, banned) is removed, and a blocked mic can only listen.
     */
    private registerVoiceGuard() {
      voiceGuards.register(this.roomUid, (identity) => {
        if (this.bans.has(identity) || !this.members.has(identity)) return "remove";
        return this.micBlocked.has(identity) ? "listen" : "ok";
      });
    }

    // ── match ─────────────────────────────────────────────────────────────────────────────────

    /** False when there is no config, too few or too many players, or the config doesn't fit them. */
    private startMatch(): boolean {
      if (this.setup === null) return false;
      const players = [...this.members.values()]
        .filter((m) => m.seat !== null && m.isConnected)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
      const { min, max } = this.setup.players;
      if (players.length < min || players.length > max) return false;
      // Match seat 0 moves to the next player every game, so the same person doesn't always lead.
      const shift = this.gamesStarted % players.length;
      const order = [...players.slice(shift), ...players.slice(0, shift)];
      let match: Match;
      try {
        match = this.setup.start(order.length, newSeed());
      } catch (error) {
        if (error instanceof RangeError) return false;
        throw error;
      }
      this.match = match;
      this.matchSetup = this.setup;
      this.matchId = randomUUID();
      this.matchStartedAt = Date.now();
      this.matchUsers = order.map((m) => m.userId);
      this.matchPlayers = order.map(({ userId, nickname, color }) => ({ userId, nickname, color }));
      this.gamesStarted++;
      this.phase = "playing";
      this.deadlineClock = null;
      this.recentActionIds.length = 0;
      this.log.info(
        { event: "match_started", gameId: match.gameId, seats: order.length },
        "match_started",
      );
      this.broadcastRoom();
      this.afterMove();
      return true;
    }

    /** After any accepted move: everyone's view, then either the results or the next deadline. */
    private afterMove() {
      this.sendViews();
      if (this.match?.result() != null) {
        this.phase = "results";
        this.deadlineTimer?.clear();
        this.deadlineClock = null;
        this.broadcastDeadline(null);
        // Seats of players who left mid-game are released now that the game is over.
        for (const member of this.members.values()) {
          if (!member.isConnected) this.members.delete(member.userId);
        }
        this.log.info({ event: "match_finished" }, "match_finished");
        this.saveMatch("finished");
        this.broadcastRoom();
        return;
      }
      this.scheduleDeadline();
    }

    private scheduleDeadline() {
      this.deadlineTimer?.clear();
      this.deadlineTimer = null;
      const deadline = this.phase === "playing" ? (this.match?.deadline() ?? null) : null;
      const now = Date.now();
      const isAway = deadline !== null && !this.isSeatPresent(deadline.seat);
      this.deadlineClock = trackDeadline(this.deadlineClock, deadline, now, isAway);
      if (deadline === null || this.deadlineClock === null || this.match === null) {
        this.broadcastDeadline(null);
        return;
      }
      const ms = msUntilDue(this.deadlineClock, deadline, now);
      this.broadcastDeadline({
        seat: deadline.seat,
        key: deadline.key,
        msLeft: ms === null ? null : Math.max(0, Math.round(ms)),
        totalMs: deadline.at,
      });
      if (ms === null) return;
      const turnSeq = this.match.turnSeq();
      this.deadlineTimer = this.clock.setTimeout(
        () => {
          void this.queue.enqueue(() => {
            this.onDeadline(turnSeq);
          });
        },
        Math.max(0, ms),
      );
    }

    /** A timer only acts if nothing moved since it was set; otherwise a newer timer owns the turn. */
    private onDeadline(turnSeq: number) {
      const match = this.match;
      if (match === null || this.phase !== "playing" || match.turnSeq() !== turnSeq) return;
      const deadline = match.deadline();
      if (deadline === null || this.deadlineClock === null) return;
      const ms = msUntilDue(this.deadlineClock, deadline, Date.now());
      if (ms === null || ms > 0) {
        this.scheduleDeadline();
        return;
      }
      match.autoPlay(deadline.seat);
      this.log.info({ event: "auto_played", seat: deadline.seat, turnSeq }, "auto_played");
      this.afterMove();
    }

    // ── presence and sending ──────────────────────────────────────────────────────────────────

    private memberOf(client: Client): Member | undefined {
      for (const member of this.members.values()) {
        if (member.sessionId === client.sessionId) return member;
      }
      return undefined;
    }

    private setConnected(client: Client, isConnected: boolean) {
      const member = this.memberOf(client);
      if (member === undefined) return;
      this.members.set(member.userId, { ...member, isConnected });
      this.afterPresenceChange();
    }

    /** Presence changes the room message and can pause or resume an away-only deadline. */
    private afterPresenceChange() {
      this.broadcastRoom();
      if (this.phase === "playing") this.scheduleDeadline();
    }

    /** Present = connected with the room on screen; anything else is away for the turn clock. */
    private isSeatPresent(seat: number): boolean {
      const userId = this.matchUsers[seat];
      return (
        userId !== undefined &&
        this.members.get(userId)?.isConnected === true &&
        !this.hidden.has(userId)
      );
    }

    private onPresence(client: Client, isVisible: boolean) {
      const member = this.memberOf(client);
      if (member === undefined) return;
      if (isVisible) {
        this.setVisible(member.userId);
      } else if (!this.hidden.has(member.userId)) {
        // Players keep their voice (they're in the game); a spectator who wandered off doesn't.
        const timer =
          member.seat === null
            ? this.clock.setTimeout(() => {
                void deps.voice.remove(this.roomUid, member.userId);
                this.log.info({ event: "voice_idle_removed", userId: member.userId }, "voice_idle");
              }, deps.spectatorVoiceIdleMs ?? SPECTATOR_VOICE_IDLE_MS)
            : null;
        this.hidden.set(member.userId, timer);
      } else {
        return;
      }
      if (this.phase === "playing") this.scheduleDeadline();
    }

    private setVisible(userId: string) {
      this.hidden.get(userId)?.clear();
      this.hidden.delete(userId);
    }

    private viewerFor(member: Member): Viewer {
      const seat = this.matchUsers.indexOf(member.userId);
      return seat < 0 ? { kind: "spectator" } : { kind: "seat", seat };
    }

    private sendView(client: Client) {
      const member = this.memberOf(client);
      if (this.match === null || member === undefined) return;
      client.send("game", {
        type: "game",
        seq: this.match.turnSeq(),
        view: this.match.view(this.viewerFor(member)),
      });
    }

    private sendViews() {
      for (const client of this.clients) this.sendView(client);
      this.markChanged();
    }

    private broadcastDeadline(deadline: DeadlineMessage["deadline"]) {
      this.broadcast("deadline", { type: "deadline", deadline } satisfies DeadlineMessage);
    }

    private sendError(client: Client, code: ErrorCode) {
      client.send("error", { type: "error", code, message: ERROR_MESSAGES[code] });
    }

    private broadcastRoom() {
      if (this.hostId === null) return;
      const members = [...this.members.values()];
      const message: RoomMessage = {
        type: "room",
        code: this.roomId,
        hostId: this.hostId,
        isLocked: this.isLocked,
        phase: this.phase,
        gameId: this.setup?.gameId ?? null,
        seats: members
          .filter((m): m is Member & { seat: number } => m.seat !== null)
          .sort((a, b) => a.seat - b.seat)
          .map((m) => ({
            seat: m.seat,
            userId: m.userId,
            nickname: m.nickname,
            isConnected: m.isConnected,
            color: m.color,
          })),
        spectators: members
          .filter((m) => m.seat === null)
          .map((m) => ({ userId: m.userId, nickname: m.nickname })),
        matchPlayers: this.matchPlayers,
        gameConfig: this.setup?.config ?? null,
        micBlocked: [...this.micBlocked],
      };
      this.broadcast("room", message);
      this.markChanged();
    }

    // ── database ──────────────────────────────────────────────────────────────────────────────

    /**
     * What the database says about a checkpoint's room and game. If it can't be asked, the room
     * still comes back: losing everyone's game to a database blip is worse than the rare roll-back.
     */
    private async restoreFacts(
      snapshot: RoomSnapshot,
    ): Promise<{ isRoomClosed: boolean; isMatchRecorded: boolean }> {
      try {
        const [isRoomClosed, isMatchRecorded] = await Promise.all([
          deps.store.isRoomClosed(snapshot.roomUid),
          snapshot.match === null
            ? Promise.resolve(false)
            : deps.store.isMatchRecorded(snapshot.match.id),
        ]);
        return { isRoomClosed, isMatchRecorded };
      } catch (error) {
        this.log.warn({ event: "restore_check_failed", err: error }, "restore_check_failed");
        return { isRoomClosed: false, isMatchRecorded: false };
      }
    }

    private saveMatch(status: "finished") {
      const match = this.match;
      const setup = this.matchSetup;
      if (match === null || setup === null) return;
      const { seed, actions } = match.record();
      this.persist("match_save_failed", () =>
        deps.store.recordMatch({
          id: this.matchId,
          gameId: match.gameId,
          moduleVersion: setup.moduleVersion,
          config: setup.config,
          configIsRanked: setup.isRanked,
          seed,
          startedAt: new Date(this.matchStartedAt),
          endedAt: new Date(),
          status,
          users: [...this.matchUsers],
          nicknames: this.matchPlayers.map((p) => p.nickname),
          result: match.result(),
          actions: [...actions] as MatchToRecord["actions"],
        }),
      );
    }

    /** A game lost in a restart that didn't have two of its players back. */
    private saveAbandoned(saved: MatchSnapshot) {
      this.persist("match_save_failed", () =>
        deps.store.recordMatch({
          id: saved.id,
          gameId: saved.gameId,
          moduleVersion: saved.moduleVersion,
          config: saved.config,
          configIsRanked: false,
          seed: new Uint8Array(Buffer.from(saved.seed, "base64url")),
          startedAt: new Date(saved.startedAt),
          endedAt: new Date(),
          status: "abandoned",
          users: saved.users,
          nicknames: saved.players.map((p) => p.nickname),
          result: null,
          actions: saved.actions,
        }),
      );
    }

    private saveEvent(type: RoomEventType, data?: Record<string, unknown>) {
      this.persist("room_event_failed", () => deps.store.recordRoomEvent(this.roomUid, type, data));
    }

    /** Database writes never hold up the game: they run on their own and failures are logged. */
    private persist(failure: string, write: () => Promise<void>) {
      write().catch((error: unknown) => {
        this.log.error({ event: failure, err: error }, failure);
      });
    }

    // ── checkpoints ───────────────────────────────────────────────────────────────────────────

    /** Seals once per burst of changes (a move changes the views and the room message together). */
    private markChanged() {
      if (this.isCheckpointDue) return;
      this.isCheckpointDue = true;
      queueMicrotask(() => {
        this.isCheckpointDue = false;
        const snapshot = this.snapshot();
        if (snapshot === null) return;
        const checkpoint = deps.sealer.seal(snapshot);
        this.broadcast("checkpoint", { type: "checkpoint", checkpoint });
      });
    }

    private snapshot(): RoomSnapshot | null {
      if (this.hostId === null || this.restoring !== null) return null;
      const record = this.match?.record();
      const setup = this.matchSetup;
      return {
        bootId: deps.bootId,
        roomId: this.roomId,
        roomUid: this.roomUid,
        seq: ++this.checkpointSeq,
        issuedAt: Date.now(),
        hostId: this.hostId,
        isLocked: this.isLocked,
        bans: [...this.bans],
        micBlocked: [...this.micBlocked],
        gamesStarted: this.gamesStarted,
        phase: this.phase,
        members: [...this.members.values()].map(({ userId, nickname, color, seat }) => ({
          userId,
          nickname,
          color,
          seat,
        })),
        setup:
          this.setup === null ? null : { gameId: this.setup.gameId, config: this.setup.config },
        match:
          this.match === null || record === undefined || setup === null
            ? null
            : {
                id: this.matchId,
                startedAt: this.matchStartedAt,
                gameId: this.match.gameId,
                moduleVersion: setup.moduleVersion,
                config: setup.config,
                seats: this.match.seats,
                seed: Buffer.from(record.seed).toString("base64url"),
                actions: [...record.actions],
                users: [...this.matchUsers],
                players: [...this.matchPlayers],
              },
      };
    }

    /** Every player seated in the newest checkpoint so far is back, so waiting longer gains nothing. */
    private everyoneBack(): boolean {
      if (this.restoring === null) return false;
      const choice = chooseRestore(this.restoring.resumes, deps.bootId);
      if (choice === null) return false;
      const back = new Set(this.restoring.sessions.values());
      return choice.snapshot.members.every((m) => m.seat === null || back.has(m.userId));
    }

    private restoreMatch(saved: MatchSnapshot): { setup: MatchSetup; match: Match } | null {
      if (!isGameId(saved.gameId)) return null;
      const module = GAMES[saved.gameId];
      // Another version of the rules could replay the same moves differently.
      if (module.version !== saved.moduleVersion) return null;
      const setup = prepareMatch(module, saved.config);
      const seed = new Uint8Array(Buffer.from(saved.seed, "base64url"));
      const match = setup?.restore(saved.seats, seed, saved.actions) ?? null;
      return setup === null || match === null ? null : { setup, match };
    }

    /** Rebuilds the room from the best checkpoint its players sent (design doc › Restoring safely). */
    private async finishRestore() {
      const restoring = this.restoring;
      if (restoring === null) return;
      this.restoring = null;
      restoring.timer.clear();
      const choice = chooseRestore(restoring.resumes, deps.bootId);
      const facts = choice === null ? null : await this.restoreFacts(choice.snapshot);
      if (choice === null || facts === null || facts.isRoomClosed) {
        void this.disconnect(CLOSE_CODES.ROOM_CLOSED);
        return;
      }
      const { snapshot } = choice;
      // A game already written (finished or abandoned) can't come back: that is the roll-back attack.
      const keepsGame = choice.keepsGame && !facts.isMatchRecorded;
      voiceGuards.unregister(this.roomUid);
      this.roomUid = snapshot.roomUid;
      this.registerVoiceGuard();
      if (snapshot.phase === "playing" && snapshot.match !== null && !keepsGame) {
        if (!facts.isMatchRecorded) this.saveAbandoned(snapshot.match);
      }
      const sessionOf = new Map(
        [...restoring.sessions].map(([sessionId, userId]) => [userId, sessionId]),
      );

      this.hostId = snapshot.hostId;
      this.isLocked = snapshot.isLocked;
      for (const userId of snapshot.bans) this.bans.add(userId);
      for (const userId of snapshot.micBlocked) this.micBlocked.add(userId);
      this.gamesStarted = snapshot.gamesStarted;
      this.setup =
        snapshot.setup !== null && isGameId(snapshot.setup.gameId)
          ? prepareMatch(GAMES[snapshot.setup.gameId], snapshot.setup.config)
          : null;
      // Only a game still in progress comes back (with two of its players); results are already saved.
      const restored =
        keepsGame && snapshot.match !== null ? this.restoreMatch(snapshot.match) : null;
      if (restored !== null && snapshot.match !== null) {
        this.match = restored.match;
        this.matchSetup = restored.setup;
        this.matchId = snapshot.match.id;
        this.matchStartedAt = snapshot.match.startedAt;
        this.matchUsers = [...snapshot.match.users];
        this.matchPlayers = [...snapshot.match.players];
        this.phase = snapshot.phase;
      } else {
        this.phase = "lobby";
      }

      for (const saved of snapshot.members) {
        const sessionId = sessionOf.get(saved.userId);
        // A player who isn't back keeps their game seat (the server plays it), nothing else.
        const isPlaying = this.phase === "playing" && this.matchUsers.includes(saved.userId);
        if (sessionId === undefined && !isPlaying) continue;
        this.members.set(saved.userId, {
          ...saved,
          sessionId: sessionId ?? "",
          isConnected: sessionId !== undefined,
        });
      }
      // Someone back whose own (older) checkpoint has them but the chosen one doesn't.
      for (const [userId, sessionId] of sessionOf) {
        if (this.members.has(userId)) continue;
        const saved = restoring.resumes
          .find((r) => r.userId === userId)
          ?.snapshot.members.find((m) => m.userId === userId);
        if (saved === undefined) continue;
        const others = [...this.members.values()];
        this.members.set(userId, {
          ...saved,
          color: pickColor(saved.color, userId, others),
          seat: this.phase === "lobby" ? freeSeat(others, LIMITS.MAX_SEATS) : null,
          sessionId,
          isConnected: true,
        });
      }
      if (this.members.get(this.hostId)?.isConnected !== true) {
        this.hostId = nextHost([...this.members.values()], this.hostId) ?? this.hostId;
      }
      this.log.info(
        { event: "checkpoint_restored", phase: this.phase, back: sessionOf.size },
        "checkpoint_restored",
      );
      this.saveEvent("restored", { phase: this.phase });
      this.broadcastRoom();
      this.sendViews();
      if (this.phase === "playing") this.scheduleDeadline();
    }
  };
}
