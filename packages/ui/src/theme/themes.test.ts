import { SEAT_COLOR_IDS } from "@heartroom/protocol";
import { describe, expect, it } from "vitest";
import { contrast, ensureContrast, mix, readableOn } from "./color.ts";
import {
  CUSTOM_VARIABLES,
  customFromTheme,
  customPalette,
  customVariables,
  customWarnings,
  parseCustomTheme,
} from "./custom.ts";
import { STORAGE_KEYS, THEME_BOOT_SCRIPT, themeCss } from "./css.ts";
import { paletteVariables, SEAT_COLORS, THEMES } from "./themes.ts";

const sides = THEMES.flatMap((t) =>
  (["light", "dark"] as const).map((side) => ({ name: `${t.label} ${side}`, side, p: t[side] })),
);

describe("built-in themes", () => {
  it("have unique ids", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it.each(sides)("$name: text, secondary text and actions meet WCAG AA", ({ p }) => {
    for (const surface of [p.paper, p.sheet]) {
      expect(contrast(p.ink, surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.pencil, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.pen, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.margin, surface)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(p.ink, p.well)).toBeGreaterThanOrEqual(4.5);
    const vars = paletteVariables(p);
    expect(contrast(vars["--color-on-pen"] as string, p.pen)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(sides)("$name: every player colour stands out on the board", ({ p, side }) => {
    for (const seat of SEAT_COLORS) expect(contrast(seat[side], p.sheet)).toBeGreaterThanOrEqual(3);
  });
});

describe("colour maths", () => {
  it("measures black on white as 21:1 and mixes halfway", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("picks readable text and pushes a weak colour until it reads", () => {
    expect(readableOn("#ffffff")).not.toBe("#ffffff");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(contrast(ensureContrast("#cccccc", "#ffffff", 4.5), "#ffffff")).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(ensureContrast("#333333", "#000000", 4.5), "#000000")).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("custom theme", () => {
  const base = customFromTheme("sage");

  it("starts from a built-in theme's colours, and falls back to Notebook", () => {
    expect(base.light.accent).toBe(THEMES.find((t) => t.id === "sage")?.light.pen);
    expect(customFromTheme("nope").light.page).toBe(THEMES[0].light.paper);
  });

  it("derives secondary text that stays legible even from a low-contrast pick", () => {
    const p = customPalette(
      { page: "#ffffff", card: "#ffffff", text: "#999999", accent: "#3366ff" },
      "light",
    );
    expect(contrast(p.pencil, p.sheet)).toBeGreaterThanOrEqual(4.5);
  });

  it("produces exactly the variables the boot script checks for", () => {
    expect(Object.keys(customVariables(base)).sort()).toEqual([...CUSTOM_VARIABLES].sort());
  });

  it("warns about weak text and accent, and not about a good pick", () => {
    expect(
      customWarnings({ page: "#fff000", card: "#ffffff", text: "#dddddd", accent: "#eeeeee" }),
    ).toHaveLength(2);
    expect(customWarnings(base.light)).toEqual([]);
  });

  it("parses only complete, well-formed themes", () => {
    expect(parseCustomTheme(base)).toEqual(base);
    expect(parseCustomTheme({ light: base.light })).toBeNull();
    expect(parseCustomTheme({ ...base, dark: { ...base.dark, text: "red" } })).toBeNull();
    expect(parseCustomTheme("x")).toBeNull();
    expect(parseCustomTheme({ light: null, dark: base.dark })).toBeNull();
  });
});

describe("theme css", () => {
  it("has a light and a dark block for every theme, plus custom and text sizes", () => {
    const css = themeCss();
    for (const t of THEMES) {
      expect(css).toContain(`:root[data-theme="${t.id}"]{`);
      expect(css).toContain(`:root[data-theme="${t.id}"][data-mode="dark"]{`);
    }
    expect(css).toContain(':root[data-theme="custom"]');
    expect(css).toContain('[data-text-size="large"]');
  });

  /** Runs the boot script against a fake <html> and storage. */
  function boot(stored: Record<string, string>, isSystemDark = false) {
    const attributes: Record<string, string> = {};
    const styles: Record<string, string> = {};
    const html = {
      setAttribute: (name: string, value: string) => (attributes[name] = value),
      style: { setProperty: (name: string, value: string) => (styles[name] = value) },
    };
    // The boot script ships as a string for an inline <script>; this is the one way to run it here.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function("document", "localStorage", "matchMedia", THEME_BOOT_SCRIPT) as (
      ...args: unknown[]
    ) => void;
    run({ documentElement: html }, { getItem: (key: string) => stored[key] ?? null }, () => ({
      matches: isSystemDark,
    }));
    return { attributes, styles };
  }

  it("applies a saved theme, mode and text size before first paint", () => {
    const { attributes } = boot({
      [STORAGE_KEYS.theme]: '"sage"',
      [STORAGE_KEYS.mode]: '"dark"',
      [STORAGE_KEYS.textSize]: '"large"',
    });
    expect(attributes).toEqual({
      "data-theme": "sage",
      "data-mode": "dark",
      "data-text-size": "large",
    });
  });

  it("falls back to Notebook following the system when storage holds junk", () => {
    const { attributes } = boot(
      { [STORAGE_KEYS.theme]: "{oops", [STORAGE_KEYS.mode]: '"neon"' },
      true,
    );
    expect(attributes).toEqual({ "data-theme": "notebook", "data-mode": "dark" });
  });

  it("uses a custom theme only when every colour is present and well formed", () => {
    const variables = customVariables(customFromTheme("clay"));
    const good = boot({
      [STORAGE_KEYS.theme]: '"custom"',
      [STORAGE_KEYS.custom]: JSON.stringify(variables),
    });
    expect(good.attributes["data-theme"]).toBe("custom");
    expect(Object.keys(good.styles)).toHaveLength(CUSTOM_VARIABLES.length);
    const bad = boot({
      [STORAGE_KEYS.theme]: '"custom"',
      [STORAGE_KEYS.custom]: JSON.stringify({ ...variables, "--custom-light-paper": "red" }),
    });
    expect(bad.attributes["data-theme"]).toBe("notebook");
    expect(bad.styles).toEqual({});
  });
});

describe("SEAT_COLORS", () => {
  it("lists the server's colour ids in the server's order (the room hands out the next free one)", () => {
    expect(SEAT_COLORS.map((c) => c.id)).toEqual([...SEAT_COLOR_IDS]);
  });
});
