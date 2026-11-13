/**
 * Error codes on the wire. The server sends `{ code, message }` only, where `message` is safe copy
 * from `ERROR_MESSAGES`; the web app may show its own copy per code. Additive changes only.
 */
export const ERROR_CODES = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_LOCKED: "ROOM_LOCKED",
  BANNED: "BANNED",
  STALE_TURN: "STALE_TURN",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  RULE_VIOLATION: "RULE_VIOLATION",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_MESSAGE: "INVALID_MESSAGE",
  CHECKPOINT_REJECTED: "CHECKPOINT_REJECTED",
  INTERNAL: "INTERNAL",
  NAME_TAKEN: "NAME_TAKEN",
  NOT_AVAILABLE_YET: "NOT_AVAILABLE_YET",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Server-side safe copy. Never includes hidden game data, ids or library error text. */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  ROOM_NOT_FOUND: "That room doesn’t exist or has closed.",
  ROOM_LOCKED: "The host has locked this room.",
  BANNED: "You can’t join this room.",
  STALE_TURN: "The game moved on before your move arrived.",
  NOT_YOUR_TURN: "It’s not your turn yet.",
  RULE_VIOLATION: "That move isn’t allowed.",
  RATE_LIMITED: "Too many tries. Wait a moment and try again.",
  UNAUTHORIZED: "Please sign in again.",
  INVALID_MESSAGE: "Something went wrong sending that.",
  CHECKPOINT_REJECTED: "That game can’t be resumed.",
  INTERNAL: "Something went wrong on our side.",
  NAME_TAKEN: "Someone in this room already has that name.",
  NOT_AVAILABLE_YET: "That isn’t available yet.",
};

/**
 * WebSocket close codes. 4000–4999 is the application range, but Colyseus 0.18 already uses
 * 4000–4003 and 4010 (and its client auto-reconnects on 4010), so ours start at 4100. None of these
 * makes the client reconnect by itself: a kicked or banned player must not bounce straight back.
 */
export const CLOSE_CODES = {
  RESTARTING: 4101,
  KICKED: 4102,
  BANNED: 4103,
  TAKEN_OVER: 4104,
  ROOM_CLOSED: 4105,
  /** Too many invalid messages in a minute. */
  INVALID_MESSAGES: 4106,
} as const;

export type CloseCode = (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES];
