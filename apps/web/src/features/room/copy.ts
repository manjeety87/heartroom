import { ERROR_MESSAGES } from "@heartroom/protocol";
import type { ClosedReason, JoinFailure } from "@/lib/room-client/state";

/** Words for a refused create/join. Never the server's or the library's raw text. */
export function joinFailureCopy(failure: JoinFailure): { message: string; suggestion?: string } {
  switch (failure.code) {
    case "UNREACHABLE":
      return { message: "Can’t reach the game. Check your connection and try again." };
    case "NAME_TAKEN":
      return failure.suggestion === undefined
        ? { message: "Someone here already has that name. Try another." }
        : {
            message: `Someone here already has that name. How about “${failure.suggestion}”?`,
            suggestion: failure.suggestion,
          };
    case "ROOM_NOT_FOUND":
      return { message: "That room doesn’t exist or has closed. Check the code with your friend." };
    case "UNAUTHORIZED":
      return { message: "We couldn’t confirm it’s you. Refresh the page and try again." };
    default:
      return { message: ERROR_MESSAGES[failure.code] };
  }
}

/** Why you are no longer in the room, and whether coming back makes sense. */
export const CLOSED_COPY: Readonly<
  Record<ClosedReason, { title: string; body: string; canRejoin: boolean }>
> = {
  left: {
    title: "You left the room",
    body: "Your friends can carry on without you.",
    canRejoin: true,
  },
  kicked: { title: "The host removed you", body: "You can’t rejoin this room.", canRejoin: false },
  banned: {
    title: "You can’t join this room",
    body: "The host removed you earlier.",
    canRejoin: false,
  },
  taken_over: {
    title: "Opened somewhere else",
    body: "This room is open in another tab or device, so this one stepped aside.",
    canRejoin: true,
  },
  room_closed: {
    title: "The room has closed",
    body: "Start a new one to keep playing.",
    canRejoin: false,
  },
  invalid_messages: {
    title: "Disconnected",
    body: "Something on this page went wrong talking to the game.",
    canRejoin: true,
  },
  restarting: {
    title: "The game server restarted",
    body: "Rejoin to see if your room is still there.",
    canRejoin: true,
  },
  lost: {
    title: "Connection lost",
    body: "We tried for a while but couldn’t get back in. Your seat is held for a minute.",
    canRejoin: true,
  },
};
