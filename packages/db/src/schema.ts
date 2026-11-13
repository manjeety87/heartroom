import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Better Auth's tables (core + the anonymous and JWT plugins). Field names are the ones Better Auth
 * asks its adapter for, so a column is renamed only through the auth config, never here alone.
 * We keep no profile photo, no real name and no IP or user agent (design doc › Accounts and identity):
 * `name` holds the nickname-to-be, and the session hook in apps/web clears the tracking columns.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  /** When the person ticked "I'm 18 or older" (asked once, at their first room join). */
  ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** Signing keys for the game-server JWT. The private key is stored encrypted with AUTH_SECRET. */
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  alg: text("alg"),
  crv: text("crv"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// ── games ──────────────────────────────────────────────────────────────────────────────────────

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

/**
 * One finished or abandoned online game, written once by the game server (`id` is made there, so a
 * repeated write is a no-op). Everything game-specific lives in jsonb, so a new game needs no
 * migration. `actions` is cleared after 30 days to keep the database small; results stay.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey(),
    gameId: text("game_id").notNull(),
    moduleVersion: integer("module_version").notNull(),
    config: jsonb("config").notNull(),
    seed: bytea("seed").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: ["finished", "abandoned"] }).notNull(),
    /** Computed by the server when the match is written; clients never send stats. */
    ranked: boolean("ranked").notNull(),
    playerCount: integer("player_count").notNull(),
    actions: jsonb("actions"),
  },
  (table) => [
    index("matches_game_id_ended_at_idx").on(table.gameId, table.endedAt),
    check("matches_status_check", sql`${table.status} in ('finished', 'abandoned')`),
  ],
);

export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    /**
     * Null for a seat whose person has no account row (development identities) or deleted their
     * account (their rows are nulled first). RESTRICT: history is never lost by a cascade; a guest's
     * rows move to their Google account before the guest row is deleted.
     */
    userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
    seat: integer("seat").notNull(),
    /** The name this person played under in that room, so history can name everyone. */
    nickname: text("nickname"),
    result: text("result", { enum: ["win", "loss", "draw"] }),
    placement: integer("placement"),
    /** 1/k for a win shared by k players, 1 for a sole win, 0 otherwise. */
    winShare: numeric("win_share", { precision: 8, scale: 6, mode: "number" }).notNull(),
    details: jsonb("details"),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.seat] }),
    index("match_players_user_id_idx").on(table.userId),
  ],
);

/**
 * What happened to rooms: created, closed (and why), kicked, locked… `roomId` is the room's own
 * uuid, not its code (codes are reused). A `closed` row stops a crash checkpoint from reviving it.
 */
export const roomEvents = pgTable(
  "room_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull(),
    type: text("type").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    data: jsonb("data"),
  },
  (table) => [index("room_events_room_id_type_idx").on(table.roomId, table.type)],
);

/**
 * One voice session per LiveKit join (webhooks: participant_joined → participant_left). Minutes are
 * filled on leave; a session left open by a crash is closed at joined_at + 3 h on the next boot.
 */
export const voiceUsage = pgTable(
  "voice_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull(),
    /** The LiveKit identity: the user id (a guest, an account, or a dev id). */
    userId: text("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    minutes: numeric("minutes", { precision: 10, scale: 3, mode: "number" }),
  },
  (table) => [
    index("voice_usage_joined_at_idx").on(table.joinedAt),
    index("voice_usage_room_id_user_id_idx").on(table.roomId, table.userId),
  ],
);
