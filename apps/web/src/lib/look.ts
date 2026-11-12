"use client";

import { useEffect } from "react";
import { z } from "zod";
import {
  CUSTOM_THEME,
  customVariables,
  DARK_QUERY,
  DEFAULT_THEME,
  MODES,
  parseCustomTheme,
  STORAGE_KEYS,
  TEXT_SIZES,
  THEMES,
  type CustomTheme,
  type Mode,
  type TextSize,
} from "@heartroom/ui";
import { useStored, writeStored } from "./stored.ts";

/**
 * The person's look (theme, Auto/Light/Dark, text size, their own theme), saved on this device and
 * painted onto <html>. The boot script in the root layout reads the same keys before first paint.
 */

const themeIds: [string, ...string[]] = [CUSTOM_THEME, ...THEMES.map((t) => t.id)];
const themeSchema = z.enum(themeIds);
const modeSchema = z.enum(MODES.map((m) => m.value) as [Mode, ...Mode[]]);
const textSizeSchema = z.enum(TEXT_SIZES.map((t) => t.value) as [TextSize, ...TextSize[]]);
/** Saved as the finished CSS variables; the editor's four colours are kept alongside. */
const customSchema = z.custom<CustomTheme>((value) => parseCustomTheme(value) !== null);
const CUSTOM_SOURCE_KEY = `${STORAGE_KEYS.custom}.source`;

export const useThemeId = () => useStored(STORAGE_KEYS.theme, themeSchema, DEFAULT_THEME);
export const useMode = () => useStored(STORAGE_KEYS.mode, modeSchema, "system");
export const useTextSize = () => useStored(STORAGE_KEYS.textSize, textSizeSchema, "medium");
export const useCustomTheme = () => useStored(CUSTOM_SOURCE_KEY, customSchema.nullable(), null);

const root = () => document.documentElement;

function paintMode(mode: Mode): void {
  const isDark = mode === "dark" || (mode === "system" && window.matchMedia(DARK_QUERY).matches);
  root().dataset["mode"] = isDark ? "dark" : "light";
}

export function setThemeId(id: string): void {
  writeStored(STORAGE_KEYS.theme, id);
  root().dataset["theme"] = id;
}

export function setMode(mode: Mode): void {
  writeStored(STORAGE_KEYS.mode, mode);
  paintMode(mode);
}

export function setTextSize(size: TextSize): void {
  writeStored(STORAGE_KEYS.textSize, size);
  if (size === "medium") delete root().dataset["textSize"];
  else root().dataset["textSize"] = size;
}

/** Saves and switches to the person's own theme. */
export function saveCustomTheme(theme: CustomTheme): void {
  const variables = customVariables(theme);
  for (const [name, value] of Object.entries(variables)) root().style.setProperty(name, value);
  writeStored(STORAGE_KEYS.custom, variables);
  writeStored(CUSTOM_SOURCE_KEY, theme);
  setThemeId(CUSTOM_THEME);
}

/** Keeps "Auto" in step with the device switching between light and dark. */
export function useFollowSystemMode(): void {
  const mode = useMode();
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      paintMode("system");
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, [mode]);
}
