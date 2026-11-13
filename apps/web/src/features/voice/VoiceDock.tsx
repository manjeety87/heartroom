"use client";

import { useEffect } from "react";
import type { RoomMessage } from "@heartroom/protocol";
import { Button, seatColorVar } from "@heartroom/ui";
import { sendHost } from "@/lib/room-client/client";
import {
  joinVoice,
  leaveVoice,
  setMic,
  setSpeaker,
  startAudio,
  useVoice,
  type VoicePerson,
  type VoiceProblem,
} from "@/lib/voice/client";

const PROBLEM_COPY: Readonly<Record<VoiceProblem, string>> = {
  unavailable: "Voice isn’t available right now. The game still works.",
  dropped: "Voice dropped. Tap Join voice to come back.",
  removed: "You were taken out of voice.",
  idle: "Left voice: nobody else was in it for 3 minutes.",
  mic_denied: "Your browser blocked the mic. Allow it in the site settings, then try again.",
  mic_insecure: "The mic needs a secure (https) link. You can still listen.",
  mic_failed: "Your mic couldn’t start. Check that no other app is using it.",
};

/**
 * Room voice, docked at the bottom of the room: Join voice, then Mic / Speaker / Leave and who's in
 * voice with a speaking ring. The host can block anyone's mic from here, in a game or not.
 */
export function VoiceDock({ room, me }: { readonly room: RoomMessage; readonly me: string }) {
  const status = useVoice((s) => s.status);
  const people = useVoice((s) => s.people);
  const isMicOn = useVoice((s) => s.isMicOn);
  const isSpeakerOn = useVoice((s) => s.isSpeakerOn);
  const needsAudioTap = useVoice((s) => s.needsAudioTap);
  const problem = useVoice((s) => s.problem);
  const isBlocked = room.micBlocked?.includes(me) ?? false;
  const isHost = room.hostId === me;

  // Leaving the room screen (or the room) leaves its voice.
  useEffect(
    () => () => {
      void leaveVoice();
    },
    [],
  );
  // A block lands while the mic is on: LiveKit has already stopped it; make the button agree.
  useEffect(() => {
    if (isBlocked && isMicOn) void setMic(false);
  }, [isBlocked, isMicOn]);

  const colorOf = (identity: string) => {
    const color = room.seats.find((s) => s.userId === identity)?.color;
    return color === undefined ? "var(--color-pencil)" : seatColorVar(color);
  };

  return (
    <section
      aria-label="Voice"
      className="sticky bottom-0 z-10 -mx-gutter flex flex-col gap-3 border-t border-line bg-paper/90 px-gutter pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl contrast-more:bg-paper reduced-transparency:bg-paper reduced-transparency:backdrop-blur-none"
    >
      {problem !== null && (
        <p role="status" className="text-small text-pencil">
          {PROBLEM_COPY[problem]}
        </p>
      )}
      {status === "on" && isBlocked && (
        <p
          role="status"
          className="rounded-tile bg-highlighter px-3 py-2 text-small font-semibold text-on-highlighter"
        >
          The host turned off your mic. You can still listen.
        </p>
      )}
      {status === "on" && people.length > 0 && (
        <ul aria-label="In voice" className="flex flex-wrap gap-2">
          {people.map((person) => (
            <VoiceChip
              key={person.identity}
              person={person}
              color={colorOf(person.identity)}
              isBlocked={room.micBlocked?.includes(person.identity) ?? false}
              canModerate={isHost && !person.isMe && person.identity !== room.hostId}
            />
          ))}
        </ul>
      )}
      {status === "on" && needsAudioTap && (
        <Button
          onClick={() => {
            void startAudio();
          }}
        >
          Tap to hear voice
        </Button>
      )}

      {status === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isMicOn ? "primary" : "secondary"}
            aria-pressed={isMicOn}
            disabled={isBlocked}
            onClick={() => {
              void setMic(!isMicOn);
            }}
          >
            {isMicOn ? "Mic on" : "Mic off"}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={isSpeakerOn}
            onClick={() => {
              setSpeaker(!isSpeakerOn);
            }}
          >
            {isSpeakerOn ? "Sound on" : "Sound off"}
          </Button>
          <Button
            variant="quiet"
            className="ml-auto"
            onClick={() => {
              void leaveVoice();
            }}
          >
            Leave voice
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={status === "connecting"}
            onClick={() => {
              void joinVoice();
            }}
          >
            {status === "connecting" ? "Joining voice…" : "Join voice"}
          </Button>
          <span className="text-small text-pencil">Your mic stays off until you turn it on.</span>
        </div>
      )}
      {status === "on" && isMicOn && people.length > 1 && (
        <p className="text-caption text-pencil">Headphones stop the echo for everyone.</p>
      )}
    </section>
  );
}

/** One person in voice: a dot that grows a ring while they speak, and their mic state in words. */
function VoiceChip({
  person,
  color,
  isBlocked,
  canModerate,
}: {
  readonly person: VoicePerson;
  readonly color: string;
  readonly isBlocked: boolean;
  readonly canModerate: boolean;
}) {
  const micWord = isBlocked ? "mic blocked" : person.isMicOn ? "mic on" : "mic off";
  return (
    <li className="flex min-h-9 items-center gap-2 rounded-pill bg-well py-1 pr-1 pl-3">
      <span
        aria-hidden
        className={`size-3 shrink-0 rounded-full outline-offset-2 transition-[outline-width] duration-(--duration-press) ease-out motion-reduce:transition-none ${
          person.isSpeaking ? "outline-[3px] outline-solid" : "outline-0"
        }`}
        style={{ backgroundColor: color, outlineColor: color }}
      />
      <span className="max-w-32 truncate text-small text-ink">
        {person.isMe ? "You" : person.name}
      </span>
      <span className="text-caption text-pencil">{person.isSpeaking ? "speaking" : micWord}</span>
      {canModerate ? (
        <Button
          variant="quiet"
          className="min-h-9 px-3 text-small"
          aria-label={`${isBlocked ? "Allow" : "Block"} ${person.name}’s mic`}
          onClick={() => {
            sendHost({
              type: "host",
              kind: isBlocked ? "unblock_mic" : "block_mic",
              target: person.identity,
            });
          }}
        >
          {isBlocked ? "Allow mic" : "Block mic"}
        </Button>
      ) : (
        <span className="w-2" />
      )}
    </li>
  );
}
