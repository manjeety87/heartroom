"use client";

import { useSyncExternalStore } from "react";
import type { ZodType } from "zod";

/**
 * Per-device values in localStorage, read through zod (storage is user-editable, so it is input).
 * Every read and write is guarded: private windows and blocked storage just fall back to defaults.
 * Components subscribe with `useStored`, and other tabs are kept in step by the `storage` event.
 */

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStored<T>(key: string, schema: ZodType<T>, fallback: T): T {
  const raw = readRaw(key);
  const hit = cache.get(key);
  // Same raw string → same object, so useSyncExternalStore sees a stable snapshot.
  if (hit?.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw !== null) {
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) value = parsed.data;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the value still applies for this page view.
    cache.set(key, { raw: JSON.stringify(value), value });
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useStored<T>(key: string, schema: ZodType<T>, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key, schema, fallback),
    () => fallback,
  );
}
