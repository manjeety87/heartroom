import { mix, readableOn } from "./color.ts";

/**
 * Every built-in look, light and dark side. This file is the single source: `themeCss()` turns it
 * into CSS and `themes.test.ts` checks every pair for contrast. Notebook is the brand look from
 * docs/design/design-direction.md; the rest keep its structure (paper → sheet → well, ink, pen).
 */

export type Palette = {
  /** Page background. */
  readonly paper: string;
  /** Raised surfaces: cards, the board. */
  readonly sheet: string;
  /** Inputs, empty cells, quiet buttons. */
  readonly well: string;
  /** Text. */
  readonly ink: string;
  /** Secondary text. */
  readonly pencil: string;
  /** Primary action and focus. */
  readonly pen: string;
  /** Danger, strike, the last seconds of a timer. */
  readonly margin: string;
  /** The landing stage. */
  readonly cover: string;
};

export type Theme = {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly light: Palette;
  readonly dark: Palette;
};

export const THEMES = [
  {
    id: "notebook",
    label: "Notebook",
    note: "Navy pen, red margin",
    light: {
      paper: "#f5f7fa",
      sheet: "#ffffff",
      well: "#e3e7ef",
      ink: "#18213a",
      pencil: "#55607a",
      pen: "#2346c8",
      margin: "#c42a44",
      cover: "#cbe4f2",
    },
    dark: {
      paper: "#0f1730",
      sheet: "#18223f",
      well: "#222c4a",
      ink: "#e8ecf5",
      pencil: "#9aa6c2",
      pen: "#8fa6ff",
      margin: "#ff7a8c",
      cover: "#18223f",
    },
  },
  {
    id: "cupertino",
    label: "Cupertino Blue",
    note: "System blue on cool grey",
    light: {
      paper: "#f5f5f7",
      sheet: "#ffffff",
      well: "#e5e5ea",
      ink: "#1d1d1f",
      pencil: "#636368",
      pen: "#0066cc",
      margin: "#c4001a",
      cover: "#dbe8f7",
    },
    dark: {
      paper: "#0b0c10",
      sheet: "#1c1c1e",
      well: "#2c2c2e",
      ink: "#f5f5f7",
      pencil: "#a1a1a6",
      pen: "#409cff",
      margin: "#ff6961",
      cover: "#1c1c1e",
    },
  },
  {
    id: "sage",
    label: "Sage Atelier",
    note: "Botanical green on mist",
    light: {
      paper: "#f3f5f0",
      sheet: "#fcfdfa",
      well: "#e2e7dc",
      ink: "#1e2a22",
      pencil: "#536157",
      pen: "#3a6a4d",
      margin: "#b0402f",
      cover: "#dbe7d6",
    },
    dark: {
      paper: "#101612",
      sheet: "#1a221c",
      well: "#253028",
      ink: "#e6ede6",
      pencil: "#a0b3a5",
      pen: "#8cc5a0",
      margin: "#f08a7d",
      cover: "#1a221c",
    },
  },
  {
    id: "clay",
    label: "Clay Studio",
    note: "Terracotta on cream",
    light: {
      paper: "#f8f3ee",
      sheet: "#fffcf9",
      well: "#efe4da",
      ink: "#2b1f18",
      pencil: "#695649",
      pen: "#a84b28",
      margin: "#9f2d3f",
      cover: "#f2dfd0",
    },
    dark: {
      paper: "#17110e",
      sheet: "#231a15",
      well: "#30241d",
      ink: "#f2e8e0",
      pencil: "#bba999",
      pen: "#f0936b",
      margin: "#ff8a95",
      cover: "#231a15",
    },
  },
  {
    id: "lavender",
    label: "Lavender Dusk",
    note: "Muted plum on warm grey",
    light: {
      paper: "#f6f4f8",
      sheet: "#fdfcfe",
      well: "#e8e3ee",
      ink: "#241f2e",
      pencil: "#5f576b",
      pen: "#6b4fa0",
      margin: "#b23a4f",
      cover: "#e6ddf2",
    },
    dark: {
      paper: "#141119",
      sheet: "#1f1a26",
      well: "#2b2533",
      ink: "#ece7f2",
      pencil: "#aca2ba",
      pen: "#b9a0f0",
      margin: "#ff8a9b",
      cover: "#1f1a26",
    },
  },
  {
    id: "teal",
    label: "Pacific Teal",
    note: "Deep teal on sea-glass white",
    light: {
      paper: "#f1f6f6",
      sheet: "#fbfdfd",
      well: "#dfe9e9",
      ink: "#142526",
      pencil: "#4d6465",
      pen: "#0d6668",
      margin: "#b23a34",
      cover: "#d3ebea",
    },
    dark: {
      paper: "#0b1516",
      sheet: "#132122",
      well: "#1d2e2f",
      ink: "#e3f0f0",
      pencil: "#96b3b4",
      pen: "#5fd0cc",
      margin: "#ff8c84",
      cover: "#132122",
    },
  },
  {
    id: "sand",
    label: "Champagne Sand",
    note: "Warm gold-brown on ivory",
    light: {
      paper: "#f8f5ee",
      sheet: "#fffdf8",
      well: "#ede6d6",
      ink: "#2a2418",
      pencil: "#675d4c",
      pen: "#82540f",
      margin: "#a8362e",
      cover: "#f1e5c8",
    },
    dark: {
      paper: "#15120c",
      sheet: "#211c13",
      well: "#2e271c",
      ink: "#f1eadb",
      pencil: "#b8ad96",
      pen: "#e6b866",
      margin: "#ff8f80",
      cover: "#211c13",
    },
  },
  {
    id: "obsidian",
    label: "Obsidian & Silver",
    note: "Near-black and silver",
    light: {
      paper: "#f2f2f3",
      sheet: "#ffffff",
      well: "#e2e2e5",
      ink: "#111114",
      pencil: "#5a5a61",
      pen: "#2b2b31",
      margin: "#b3261e",
      cover: "#dcdce0",
    },
    dark: {
      paper: "#050506",
      sheet: "#141416",
      well: "#222226",
      ink: "#ececef",
      pencil: "#a0a0a8",
      pen: "#d6d6dc",
      margin: "#ff7b72",
      cover: "#141416",
    },
  },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "notebook";

/**
 * Player colours: one per seat (max 6), used for a player's name dot and the ink of the numbers
 * they call, so every board shows who called what. Fixed across themes so a player keeps their
 * colour whatever look each friend picked.
 */
export const SEAT_COLORS = [
  { id: "indigo", label: "Indigo", light: "#3d4fd8", dark: "#9aa6ff" },
  { id: "coral", label: "Coral", light: "#c2382e", dark: "#ff8a7e" },
  { id: "teal", label: "Teal", light: "#0b7470", dark: "#4fd1c5" },
  { id: "amber", label: "Amber", light: "#955700", dark: "#f2b451" },
  { id: "violet", label: "Violet", light: "#8a3fc4", dark: "#c99dff" },
  { id: "green", label: "Green", light: "#2c7a30", dark: "#7bd88a" },
] as const;

export type SeatColorId = (typeof SEAT_COLORS)[number]["id"];

/** The CSS colour for a seat colour: follows light/dark through the `--color-seat-*` tokens. */
export const seatColorVar = (id: SeatColorId): string => `var(--color-seat-${id})`;

/** CSS custom properties for one side of a palette. Derived colours are computed here, once. */
export function paletteVariables(p: Palette): Record<string, string> {
  return {
    "--color-paper": p.paper,
    "--color-sheet": p.sheet,
    "--color-well": p.well,
    "--color-ink": p.ink,
    "--color-pencil": p.pencil,
    "--color-pen": p.pen,
    "--color-on-pen": readableOn(p.pen),
    "--color-margin": p.margin,
    "--color-on-margin": readableOn(p.margin),
    "--color-cover": p.cover,
    "--color-line": mix(p.sheet, p.ink, 0.14),
  };
}
