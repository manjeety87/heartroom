"use client";

import {
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { requestVoiceToken } from "@/lib/room-client/client";

/**
 * The only livekit-client code in the app. Voice is opt-in ("Join voice"), joins with the mic off,
 * and shares no code path with the game: a voice failure changes this store and nothing else.
 */

export type VoicePerson = {
  /** The user id: the server makes it the LiveKit identity. */
  readonly identity: string;
  readonly name: string;
  readonly isMe: boolean;
  readonly isSpeaking: boolean;
  readonly isMicOn: boolean;
};

export type VoiceStatus = "off" | "connecting" | "on";

/** Why voice is off or the mic can't start, worded by the dock. */
export type VoiceProblem =
  "unavailable" | "dropped" | "removed" | "idle" | "mic_denied" | "mic_insecure" | "mic_failed";

export type VoiceState = {
  readonly status: VoiceStatus;
  readonly people: readonly VoicePerson[];
  readonly isMicOn: boolean;
  readonly isSpeakerOn: boolean;
  /** iOS (and some Androids) refuse to play audio until a tap: the dock shows "Tap to hear voice". */
  readonly needsAudioTap: boolean;
  readonly problem: VoiceProblem | null;
};

const INITIAL: VoiceState = {
  status: "off",
  people: [],
  isMicOn: false,
  isSpeakerOn: true,
  needsAudioTap: false,
  problem: null,
};

/** Alone in voice this long → leave, so an open tab doesn't burn the month's minutes. */
export const IDLE_LEAVE_MS = 3 * 60_000;

const store = createStore<VoiceState>(() => INITIAL);
export const useVoice = <T>(selector: (state: VoiceState) => T): T => useStore(store, selector);

let room: Room | null = null;
let idleTimer: number | null = null;
/** Hidden <audio> elements for the people we hear; muted together by the speaker toggle. */
const players = new Set<HTMLMediaElement>();

function personOf(participant: Participant, isMe: boolean): VoicePerson {
  return {
    identity: participant.identity,
    name: participant.name ?? "",
    isMe,
    isSpeaking: participant.isSpeaking,
    isMicOn: participant.isMicrophoneEnabled,
  };
}

function refresh() {
  if (room === null) return;
  const people = [
    personOf(room.localParticipant, true),
    ...[...room.remoteParticipants.values()].map((p) => personOf(p, false)),
  ];
  store.setState({
    people,
    isMicOn: room.localParticipant.isMicrophoneEnabled,
    needsAudioTap: !room.canPlaybackAudio,
  });
  watchIdle(people.length > 1);
}

function watchIdle(hasCompany: boolean) {
  if (hasCompany) {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = null;
    return;
  }
  idleTimer ??= window.setTimeout(() => {
    void leaveVoice("idle");
  }, IDLE_LEAVE_MS);
}

function onTrackSubscribed(track: RemoteTrack) {
  if (track.kind !== Track.Kind.Audio) return;
  const element = track.attach();
  element.muted = !store.getState().isSpeakerOn;
  element.hidden = true;
  players.add(element);
  document.body.append(element);
}

function onTrackUnsubscribed(track: RemoteTrack) {
  for (const element of track.detach()) {
    players.delete(element);
    element.remove();
  }
}

/** The "Join voice" tap. Asks the room for a token, then connects to LiveKit (mic off). */
export async function joinVoice(): Promise<void> {
  if (store.getState().status !== "off") return;
  store.setState({ ...INITIAL, status: "connecting" });
  const answer = await requestVoiceToken();
  if (answer === null) {
    store.setState({ ...INITIAL, problem: "unavailable" });
    return;
  }
  const joining = new Room({
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  joining
    .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    .on(RoomEvent.ParticipantConnected, refresh)
    .on(RoomEvent.ParticipantDisconnected, refresh)
    .on(RoomEvent.ActiveSpeakersChanged, refresh)
    .on(RoomEvent.TrackMuted, refresh)
    .on(RoomEvent.TrackUnmuted, refresh)
    .on(RoomEvent.LocalTrackPublished, refresh)
    .on(RoomEvent.LocalTrackUnpublished, refresh)
    .on(RoomEvent.AudioPlaybackStatusChanged, refresh)
    // A host block arrives as new permissions; LiveKit has already stopped our audio.
    .on(RoomEvent.ParticipantPermissionsChanged, refresh)
    .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      if (room !== joining) return;
      const problem =
        reason === DisconnectReason.CLIENT_INITIATED
          ? null
          : reason === DisconnectReason.PARTICIPANT_REMOVED
            ? "removed"
            : "dropped";
      void leaveVoice(problem);
    });
  room = joining;
  try {
    await joining.connect(answer.url, answer.token, { autoSubscribe: true });
  } catch {
    if (room === joining) await leaveVoice("unavailable");
    return;
  }
  if (room !== joining) return; // left while connecting
  store.setState({ status: "on" });
  refresh();
  // Still inside the user's tap on most browsers; where it isn't, the dock offers a tap.
  void joining.startAudio().then(refresh, refresh);
}

/** Turns the mic on or off. The browser asks for permission on the first "on". */
export async function setMic(isOn: boolean): Promise<void> {
  if (room === null || store.getState().status !== "on") return;
  if (isOn && !window.isSecureContext) {
    // getUserMedia doesn't exist on plain http (a phone at http://<laptop-ip>).
    store.setState({ problem: "mic_insecure" });
    return;
  }
  try {
    await room.localParticipant.setMicrophoneEnabled(isOn);
    store.setState({ problem: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    store.setState({ problem: name === "NotAllowedError" ? "mic_denied" : "mic_failed" });
  }
  refresh();
}

export function setSpeaker(isOn: boolean): void {
  for (const element of players) element.muted = !isOn;
  store.setState({ isSpeakerOn: isOn });
}

/** The "Tap to hear voice" button: audio playback must start inside a user gesture on iOS. */
export async function startAudio(): Promise<void> {
  await room?.startAudio();
  refresh();
}

export async function leaveVoice(problem: VoiceProblem | null = null): Promise<void> {
  const leaving = room;
  room = null;
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = null;
  for (const element of players) element.remove();
  players.clear();
  store.setState({ ...INITIAL, problem });
  await leaving?.disconnect();
}
