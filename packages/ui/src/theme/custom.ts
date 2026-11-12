import { contrast, ensureContrast, isHex, mix } from "./color.ts";
import { paletteVariables, THEMES, type Palette } from "./themes.ts";

/**
 * "Make your own": four colours per side; the rest of the palette is derived from them. What is
 * saved is the finished set of CSS variables, so the boot script can apply it before the first
 * paint without knowing any of this.
 */

export const CUSTOM_THEME = "custom";

export const CUSTOM_COLOURS = [
  { key: "page", label: "Page", hint: "Behind everything" },
  { key: "card", label: "Board & cards", hint: "The grid and panels" },
  { key: "text", label: "Text", hint: "Numbers and words" },
  { key: "accent", label: "Accent", hint: "Buttons and your turn" },
] as const;

export const SIDES = ["light", "dark"] as const;

export type CustomColour = (typeof CUSTOM_COLOURS)[number]["key"];
export type Side = (typeof SIDES)[number];
export type CustomTheme = Readonly<Record<Side, Readonly<Record<CustomColour, string>>>>;

const notebook = THEMES[0];
const MARGIN: Readonly<Record<Side, string>> = {
  light: notebook.light.margin,
  dark: notebook.dark.margin,
};

export function customPalette(
  colours: Readonly<Record<CustomColour, string>>,
  side: Side,
): Palette {
  const { page, card, text, accent } = colours;
  return {
    paper: page,
    sheet: card,
    well: mix(card, text, 0.08),
    ink: text,
    pencil: ensureContrast(mix(text, card, 0.38), card, 4.5),
    pen: accent,
    margin: MARGIN[side],
    cover: mix(page, accent, 0.15),
  };
}

/** `--color-paper` on the light side → `--custom-light-paper`. */
const customName = (side: Side, colourVariable: string) =>
  `--custom-${side}-${colourVariable.slice("--color-".length)}`;

/** Every variable a saved custom theme sets; the boot script checks for exactly these. */
export const CUSTOM_VARIABLES: readonly string[] = SIDES.flatMap((side) =>
  Object.keys(paletteVariables(notebook.light)).map((name) => customName(side, name)),
);

/** The variables to put on <html> for a custom theme (both sides; the mode picks one in CSS). */
export function customVariables(theme: CustomTheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const side of SIDES) {
    for (const [name, value] of Object.entries(
      paletteVariables(customPalette(theme[side], side)),
    )) {
      out[customName(side, name)] = value;
    }
  }
  return out;
}

/** CSS that maps the active side's custom variables onto the colour tokens. */
export function customThemeCss(): string {
  const names = Object.keys(paletteVariables(notebook.light));
  const block = (side: Side) =>
    names.map((name) => `${name}:var(${customName(side, name)});`).join("");
  return (
    `:root[data-theme="${CUSTOM_THEME}"]{${block("light")}}` +
    `:root[data-theme="${CUSTOM_THEME}"][data-mode="dark"]{${block("dark")}}`
  );
}

/** A starting point for the editor: the given built-in theme's own colours. */
export function customFromTheme(id: string): CustomTheme {
  const theme = THEMES.find((t) => t.id === id) ?? notebook;
  const pick = (p: Palette) => ({ page: p.paper, card: p.sheet, text: p.ink, accent: p.pen });
  return { light: pick(theme.light), dark: pick(theme.dark) };
}

/** Plain-language warnings shown while editing; saving is still allowed. */
export function customWarnings(colours: Readonly<Record<CustomColour, string>>): string[] {
  const warnings: string[] = [];
  if (contrast(colours.text, colours.card) < 4.5)
    warnings.push("Text is hard to read on the board.");
  if (contrast(colours.accent, colours.card) < 3) warnings.push("The accent fades into the board.");
  return warnings;
}

export function parseCustomTheme(raw: unknown): CustomTheme | null {
  if (typeof raw !== "object" || raw === null) return null;
  const sides = raw as Record<string, unknown>;
  const read = (side: Side) => {
    const value = sides[side];
    if (typeof value !== "object" || value === null) return null;
    const colours = value as Record<string, unknown>;
    return CUSTOM_COLOURS.every(({ key }) => isHex(colours[key]))
      ? (Object.fromEntries(CUSTOM_COLOURS.map(({ key }) => [key, colours[key]])) as Record<
          CustomColour,
          string
        >)
      : null;
  };
  const light = read("light");
  const dark = read("dark");
  return light && dark ? { light, dark } : null;
}
