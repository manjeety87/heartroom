import { Room, ServerError, type AuthContext, type Client } from "@colyseus/core";
import { newSeed, type Viewer } from "@heartroom/engine";
import {
  CLOSE_CODES,
  ERROR_MESSAGES,
  LIMITS,
  clientMessage,
  joinOptions,
  type ErrorCode,
  type HostMessage,
  type JoinError,
  type RoomMessage,
  type RoomPhase,
  type SeatColorId,
} from "@heartroom/protocol";
import type { VerifyToken } from "../auth/verify-token.ts";
import type { Logger } from "../logger.ts";
import { newRoomCode } from "./codes.ts";
import { msUntilDue, trackDeadline, type DeadlineClock } from "./deadline.ts";
import { prepareMatch, type Match, type MatchSetup } from "./match.ts";
import { freeSeat, nameSuggestion, nextHost, pickColor, type Member } from "./members.ts";
import { createQueue, type Queue } from "./queue.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { GAMES, isGameId } from "./registry.ts";

export type GameRoomDeps = { readonly verifyToken: VerifyToken; readonly log: Logger };

/** Seconds a dropped player keeps their place (design doc › GameRoom › Reconnect). */
const RECONNECT_SECONDS = 60;
/** Duplicate intents are re-acknowledged, not re-applied, within this many recent ids. */
const RECENT_ACTION_IDS = 50;
const MINUTE = 60_000;

/** Codes of rooms alive in this process; one process, so this is the whole world. */
const liveCodes = new Set<string>();

// Per IP / per user across all rooms (docs/engineering/backend.md › Security checklist).
const joinPerIp = createRateLimiter({ capacity: 10, windowMs: MINUTE });
const createPerIp = createRateLimiter({ capacity: 20, windowMs: MINUTE });
const createPerUser = createRateLimiter({ capacity: 5, windowMs: MINUTE });

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

    override onCreate() {
      this.roomId = newRoomCode((code) => liveCodes.has(code));
      liveCodes.add(this.roomId);
      this.log = deps.log.child({ roomId: this.roomId });
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
      this.setConnected(client, true);
      this.sendView(client);
    }

    override onLeave(client: Client) {
      const member = this.memberOf(client);
      if (member === undefined) return; // an old socket closed after a takeover
      const isInMatch = this.phase === "playing" && this.matchUsers.includes(member.userId);
      if (isInMatch) {
        // The seat stays; its deadlines run and the server plays it until they come back.
        this.members.set(member.userId, { ...member, isConnected: false });
      } else {
        this.members.delete(member.userId);
      }
      if (this.hostId === member.userId) {
        this.hostId = nextHost([...this.members.values()], member.userId) ?? this.hostId;
      }
      this.log.info({ event: "left", userId: member.userId }, "left");
      this.afterPresenceChange();
    }

    override onDispose() {
      liveCodes.delete(this.roomId);
      this.deadlineTimer?.clear();
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
        case "resume":
        case "voice_token":
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
          this.clients.get(target.sessionId)?.leave(CLOSE_CODES.KICKED);
          this.log.info({ event: "kicked", userId: target.userId }, "kicked");
          return;
        }
        case "new_code":
        case "mute":
        case "block_mic":
        case "unblock_mic":
        case "accept_knock":
        case "deny_knock":
          this.sendError(client, "NOT_AVAILABLE_YET");
          return;
      }
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
        // Seats of players who left mid-game are released now that the game is over.
        for (const member of this.members.values()) {
          if (!member.isConnected) this.members.delete(member.userId);
        }
        this.log.info({ event: "match_finished" }, "match_finished");
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
      const isAway = deadline !== null && !this.isSeatConnected(deadline.seat);
      this.deadlineClock = trackDeadline(this.deadlineClock, deadline, now, isAway);
      if (deadline === null || this.deadlineClock === null || this.match === null) return;
      const ms = msUntilDue(this.deadlineClock, deadline, now);
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

    private isSeatConnected(seat: number): boolean {
      const userId = this.matchUsers[seat];
      return userId !== undefined && this.members.get(userId)?.isConnected === true;
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
      };
      this.broadcast("room", message);
    }
  };
}
