import { CUSTOM_THEME, CUSTOM_VARIABLES, customThemeCss } from "./custom.ts";
import { DEFAULT_THEME, paletteVariables, SEAT_COLORS, THEMES, type Palette } from "./themes.ts";

/**
 * Looks live on <html>: `data-theme` (a theme id or "custom"), `data-mode` (light | dark, already
 * resolved from Auto) and `data-text-size` (small | large; default has none). The boot script
 * sets them before the first paint from what the person saved.
 */

export const MODES = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;
export type Mode = (typeof MODES)[number]["value"];

export const TEXT_SIZES = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Default" },
  { value: "large", label: "Large" },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]["value"];

export const STORAGE_KEYS = {
  theme: "heartroom.theme",
  mode: "heartroom.mode",
  textSize: "heartroom.textSize",
  custom: "heartroom.customTheme",
} as const;

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Dark surfaces separate with a ring, not a drop shadow (design-direction.md). */
const DARK_EXTRAS = "--shadow-float:0 0 0 1px rgb(255 255 255 / 0.08);";

const declarations = (p: Palette) =>
  Object.entries(paletteVariables(p))
    .map(([name, value]) => `${name}:${value};`)
    .join("");

const seatDeclarations = (side: "light" | "dark") =>
  SEAT_COLORS.map((c) => `--color-seat-${c.id}:${c[side]};`).join("");

/**
 * All theme CSS. `:root[...]` outranks the `@theme` defaults in tokens.css. Without JavaScript
 * (no `data-mode`), the system dark setting still picks the dark side of the default theme.
 */
export function themeCss(): string {
  const notebook = THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0];
  const themes = THEMES.map(
    (t) =>
      `:root[data-theme="${t.id}"]{color-scheme:light;${declarations(t.light)}}` +
      `:root[data-theme="${t.id}"][data-mode="dark"]{color-scheme:dark;${declarations(t.dark)}}`,
  ).join("");
  return (
    `:root{${seatDeclarations("light")}}` +
    `:root[data-mode="dark"]{color-scheme:dark;${DARK_EXTRAS}${seatDeclarations("dark")}}` +
    `@media ${DARK_QUERY}{:root:not([data-mode]){color-scheme:dark;${declarations(notebook.dark)}${DARK_EXTRAS}${seatDeclarations("dark")}}}` +
    themes +
    customThemeCss() +
    `:root[data-text-size="small"]{font-size:90%}:root[data-text-size="large"]{font-size:115%}`
  );
}

/**
 * Runs in <head> before the first paint, so a saved look never flashes the default first. Values
 * are JSON (as the app's `writeStored` saves them) and come from storage, so only known names and
 * well-formed colours are applied.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,K=${JSON.stringify(
  STORAGE_KEYS,
)},ids=${JSON.stringify(THEMES.map((t) => t.id))},v=${JSON.stringify(CUSTOM_VARIABLES)},g=function(k){try{return JSON.parse(s.getItem(k))}catch(e){return null}},t=g(K.theme),m=g(K.mode),z=g(K.textSize),c=g(K.custom),ok=false;if(c&&typeof c==="object"){ok=true;for(var i=0;i<v.length;i++)if(!/^#[0-9a-f]{6}$/i.test(c[v[i]]))ok=false;if(ok)for(i=0;i<v.length;i++)d.style.setProperty(v[i],c[v[i]])}d.setAttribute("data-theme",ids.indexOf(t)>-1||(t===${JSON.stringify(
  CUSTOM_THEME,
)}&&ok)?t:${JSON.stringify(DEFAULT_THEME)});if(m!=="light"&&m!=="dark")m=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light";d.setAttribute("data-mode",m);if(z==="small"||z==="large")d.setAttribute("data-text-size",z)}catch(e){}})()`;
