"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { liveRoomsResponse, type LiveRoom, type LiveRoomsResponse } from "@heartroom/protocol";
import { Button, seatColorVar } from "@heartroom/ui";
import { gameInfo } from "@/features/room/games";
import { formatDuration, formatPercent } from "./format.ts";
import { RoomInspector } from "./RoomInspector.tsx";

/** design: frontend.md › State (admin live rooms, 5 s poll). */
const POLL_MS = 5_000;

type Load =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly data: LiveRoomsResponse; readonly at: number };

async function fetchRooms(): Promise<LiveRoomsResponse | null> {
  try {
    const answer = await fetch("/api/admin/rooms", { cache: "no-store" });
    if (!answer.ok) return null;
    const parsed = liveRoomsResponse.safeParse(await answer.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Live rooms from the game server, refreshed every 5 s while the tab is on screen. A failed refresh
 * keeps the last table and says so, rather than blanking a page someone is reading.
 */
export function LiveRooms() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [isStale, setIsStale] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchRooms();
    if (data === null) {
      setIsStale(true);
      setLoad((current) => (current.kind === "ready" ? current : { kind: "failed" }));
      return;
    }
    setIsStale(false);
    setLoad({ kind: "ready", data, at: Date.now() });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isActive = true;
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (isActive) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      isActive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh]);

  const close = async (code: string) => {
    setConfirming(null);
    let answer: Response | null = null;
    try {
      answer = await fetch(`/api/admin/rooms/${code}/close`, { method: "POST" });
    } catch {
      // Shown below as "couldn't reach".
    }
    setNotice(
      answer?.status === 204
        ? `Room ${code} is closed. Everyone in it was sent back to Play.`
        : answer?.status === 409
          ? `Room ${code} had already closed.`
          : `Couldn’t close ${code}. The game server didn’t answer; try again.`,
    );
    await refresh();
  };

  if (load.kind === "loading") {
    return (
      <div
        aria-busy
        className="h-40 animate-pulse rounded-card bg-well motion-reduce:animate-none"
      />
    );
  }
  if (load.kind === "failed") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-line p-4">
        <p className="text-body font-semibold text-ink">Can’t reach the game server</p>
        <p className="text-small text-pencil">
          Is it running? Locally: <code>pnpm dev</code>. Deployed: check{" "}
          <code>GAME_SERVER_HTTP_URL</code> on the site.
        </p>
        <Button variant="secondary" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  const { data, at } = load;
  return (
    <div className="flex flex-col gap-4">
      <ServerStrip data={data} now={at} />
      <p aria-live="polite" className="min-h-5 text-small text-pencil">
        {notice ?? (isStale ? "Couldn’t refresh: showing the last list." : "")}
      </p>
      {data.rooms.length === 0 ? (
        <p className="rounded-card border border-line p-6 text-center text-small text-pencil">
          No rooms are open right now.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-small">
            <caption className="sr-only">Live rooms</caption>
            <thead>
              <tr className="border-b border-line text-caption text-pencil">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Room
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Players
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                  Watching
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Voice
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">
                  Open for
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Idle
                </th>
                <th scope="col" className="py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((room) => (
                <Fragment key={room.code}>
                  <RoomRow
                    room={room}
                    now={at}
                    isInspecting={inspecting === room.code}
                    isConfirming={confirming === room.code}
                    onInspect={() => {
                      setInspecting((open) => (open === room.code ? null : room.code));
                    }}
                    onAskClose={() => {
                      setConfirming(room.code);
                    }}
                    onCancelClose={() => {
                      setConfirming(null);
                    }}
                    onClose={() => void close(room.code)}
                  />
                  {inspecting === room.code && (
                    <tr className="border-b border-line">
                      <td colSpan={7} className="py-4">
                        <RoomInspector room={room} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RoomRow({
  room,
  now,
  isInspecting,
  isConfirming,
  onInspect,
  onAskClose,
  onCancelClose,
  onClose,
}: {
  readonly room: LiveRoom;
  readonly now: number;
  readonly isInspecting: boolean;
  readonly isConfirming: boolean;
  readonly onInspect: () => void;
  readonly onAskClose: () => void;
  readonly onCancelClose: () => void;
  readonly onClose: () => void;
}) {
  const game = gameInfo(room.gameId)?.label ?? "No game picked";
  return (
    <tr className="border-b border-line align-top text-ink">
      <td className="py-2 pr-3">
        <span className="font-mono font-semibold tracking-wider">{room.code}</span>
        <span className="block text-caption text-pencil">
          {game} · {room.phase}
          {room.isLocked && " · locked"}
        </span>
        {room.isStuck && (
          <span className="mt-1 inline-block rounded-pill bg-margin px-2 text-caption font-semibold text-on-margin">
            Stuck
          </span>
        )}
      </td>
      <td className="py-2 pr-3">
        <ul className="flex flex-col">
          {room.seats.map((seat) => (
            <li key={seat.nickname} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seatColorVar(seat.color) }}
              />
              <span className="max-w-32 truncate">{seat.nickname}</span>
              {!seat.isConnected && <span className="text-caption text-pencil">away</span>}
            </li>
          ))}
        </ul>
      </td>
      <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">{room.spectators}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{room.inVoice}</td>
      <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">
        {formatDuration(now - room.createdAt)}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">
        {formatDuration(now - room.lastActionAt)}
      </td>
      <td className="py-2">
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="quiet" aria-expanded={isInspecting} onClick={onInspect}>
            {isInspecting ? "Hide" : "Inspect"}
          </Button>
          {isConfirming ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Close {room.code} for everyone
              </Button>
              <Button variant="quiet" onClick={onCancelClose}>
                Keep open
              </Button>
            </>
          ) : (
            <Button variant="quiet" onClick={onAskClose} aria-label={`Close room ${room.code}`}>
              Close
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** The game server's own numbers: voice against the monthly cap, uptime, reconnects, errors. */
function ServerStrip({ data, now }: { readonly data: LiveRoomsResponse; readonly now: number }) {
  const { voice, health } = data;
  const share = voice.capMinutes === null ? null : voice.monthMinutes / voice.capMinutes;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      <Stat label="Voice this month">
        {voice.isEnabled ? (
          <>
            {Math.round(voice.monthMinutes)} min
            <span className="text-pencil">
              {voice.capMinutes === null
                ? " · no cap"
                : ` of ${String(voice.capMinutes)} (${formatPercent(share ?? 0)})`}
            </span>
            {voice.isResting && (
              <span className="block text-caption text-margin">Resting: cap reached</span>
            )}
          </>
        ) : (
          <span className="text-pencil">Voice is off</span>
        )}
      </Stat>
      <Stat label="Server up for">{formatDuration(now - health.startedAt)}</Stat>
      <Stat label="Reconnects">{health.reconnects}</Stat>
      <Stat label="Errors">
        <span className={health.errors > 0 ? "font-semibold text-margin" : undefined}>
          {health.errors}
        </span>
      </Stat>
    </dl>
  );
}

function Stat({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="bg-paper p-3">
      <dt className="text-caption text-pencil">{label}</dt>
      <dd className="text-body font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  );
}
