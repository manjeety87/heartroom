/** Small colour maths for themes: WCAG contrast, readable text, mixing. Hex `#rrggbb` only. */

const HEX = /^#[0-9a-f]{6}$/i;

export const isHex = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value);

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: readonly number[]): string =>
  `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 … 21. Text needs 4.5, large text and graphics 3. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `amount` of `b` mixed into `a` (0 = all a, 1 = all b), in sRGB. */
export function mix(a: string, b: string, amount: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex(ca.map((c, i) => c + ((cb[i] ?? 0) - c) * amount));
}

/** Near-black or white, whichever reads better on `background`. */
export const readableOn = (background: string): string =>
  contrast(background, "#ffffff") >= contrast(background, "#10131c") ? "#ffffff" : "#10131c";

/**
 * Moves `colour` towards `against`'s opposite until it reaches `ratio` with `against` — used to
 * keep a derived secondary text colour legible in a person's own theme.
 */
export function ensureContrast(colour: string, against: string, ratio: number): string {
  const target = luminance(against) > 0.18 ? "#000000" : "#ffffff";
  let out = colour;
  for (let step = 0; step < 20 && contrast(out, against) < ratio; step++)
    out = mix(out, target, 0.1);
  return out;
}
