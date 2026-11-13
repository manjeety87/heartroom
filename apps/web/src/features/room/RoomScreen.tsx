"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heartroom/ui";
import { useProfile } from "@/lib/profile";
import { enterRoom, lastRoomFor, leaveRoom, useRoom } from "@/lib/room-client/client";
import { CLOSED_COPY, joinFailureCopy } from "./copy.ts";
import { Lobby } from "./Lobby.tsx";
import { NameStep } from "./NameStep.tsx";
import { RoomGame } from "./RoomGame.tsx";
import { ShareRoom } from "./ShareRoom.tsx";

/** sessionStorage has no change event within a tab; the value is read again on every render. */
const noSubscribe = () => () => undefined;

/**
 * `/r/CODE`, the whole live room in one client island: join (name + 18+), then the lobby, the game
 * and the results. A refresh in the same tab rejoins on its own; the server gives back the seat.
 */
export function RoomScreen({ code }: { readonly code: string }) {
  const status = useRoom((s) => s.status);
  const room = useRoom((s) => s.room);
  const me = useRoom((s) => s.me);
  const closed = useRoom((s) => s.closed);
  const isRestoring = useRoom((s) => s.isRestoring);
  const profile = useProfile();
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const triedRejoin = useRef(false);
  // Whether this tab was already in this room (a refresh); unknown (null) while rendering on the server.
  const wasHere = useSyncExternalStore(
    noSubscribe,
    () => lastRoomFor(code) !== null,
    () => null,
  );

  // While the form is joining, the form stays on screen (busy) so a refusal can be shown on it.
  const [isJoiningFromForm, setIsJoiningFromForm] = useState(false);
  const join = async (nickname: string) => {
    setIsJoiningFromForm(true);
    const result = await enterRoom(code, { nickname, color: profile.color });
    setIsJoiningFromForm(false);
    return result.ok ? null : joinFailureCopy(result.failure);
  };

  // Same tab, same room: go straight back in with the name used before.
  useEffect(() => {
    if (triedRejoin.current || status !== "idle" || wasHere !== true) return;
    triedRejoin.current = true;
    const last = lastRoomFor(code);
    if (last === null) return;
    void enterRoom(code, last).then((result) => {
      if (!result.ok) setRejoinError(joinFailureCopy(result.failure).message);
    });
  }, [code, status, wasHere]);

  if (status === "closed" && closed !== null) {
    return (
      <Closed
        code={code}
        reason={closed}
        onRejoin={(nickname) => enterRoom(code, { nickname, color: profile.color })}
        lastName={profile.name}
      />
    );
  }

  const isOnForm =
    (status === "idle" && wasHere === false) || (status === "connecting" && isJoiningFromForm);
  if (isOnForm) {
    return (
      <Section title={`Join room ${code}`}>
        <NameStep submitLabel="Join room" onSubmit={join} initialError={rejoinError} />
      </Section>
    );
  }

  if (status === "resuming" || (isRestoring && room === null)) {
    return (
      <Section title="Bringing your game back…">
        <p role="status" className="text-body text-pencil">
          The game server restarted. Your board, calls and seat are on their way back.
        </p>
        <div
          aria-busy
          className="h-40 animate-pulse rounded-card bg-well motion-reduce:animate-none"
        />
      </Section>
    );
  }

  if (room === null || me === null || status === "idle" || status === "connecting") {
    return (
      <Section title={`Joining ${code}…`}>
        <div
          aria-busy
          className="h-40 animate-pulse rounded-card bg-well motion-reduce:animate-none"
        />
      </Section>
    );
  }

  const isGameOn = room.phase === "playing" || room.phase === "setup";
  const isResults = room.phase === "results";

  return (
    <div className="flex flex-col gap-6">
      {status === "reconnecting" && (
        <p
          role="status"
          className="rounded-tile bg-highlighter px-3 py-2 text-small font-semibold text-on-highlighter"
        >
          Reconnecting… your seat is held for a minute.
        </p>
      )}
      {!isGameOn && <ShareRoom code={room.code} />}
      {(isGameOn || isResults) && <RoomGame room={room} me={me} />}
      {!isGameOn && <Lobby room={room} me={me} isBetweenGames={isResults} />}
      <LeaveButton isMidGame={isGameOn} />
    </div>
  );
}

function LeaveButton({ isMidGame }: { readonly isMidGame: boolean }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const leave = () => {
    void leaveRoom().then(() => {
      router.push("/play");
    });
  };
  if (isMidGame && isConfirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 self-center">
        <span className="text-small text-pencil">The game goes on without you.</span>
        <Button variant="secondary" onClick={leave}>
          Leave the game
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setIsConfirming(false);
          }}
        >
          Stay
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="quiet"
      className="self-center"
      onClick={() => {
        if (isMidGame) setIsConfirming(true);
        else leave();
      }}
    >
      Leave room
    </Button>
  );
}

function Closed({
  code,
  reason,
  onRejoin,
  lastName,
}: {
  readonly code: string;
  readonly reason: keyof typeof CLOSED_COPY;
  readonly onRejoin: (nickname: string) => Promise<unknown>;
  readonly lastName: string | null;
}) {
  const copy = CLOSED_COPY[reason];
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Section title={copy.title}>
      <p className="text-body text-pencil">{copy.body}</p>
      <div className="flex flex-wrap gap-2">
        {copy.canRejoin && lastName !== null && (
          <Button
            disabled={isBusy}
            onClick={() => {
              setIsBusy(true);
              void onRejoin(lastName).finally(() => {
                setIsBusy(false);
              });
            }}
          >
            Rejoin {code}
          </Button>
        )}
        <Link
          href="/play"
          className="inline-flex min-h-11 items-center justify-center rounded-pill bg-well px-5 text-body font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
        >
          Back to Play
        </Link>
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">{title}</h1>
      {children}
    </section>
  );
}
