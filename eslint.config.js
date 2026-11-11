// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Globals that would make rules depend on a platform, a clock or I/O. */
const PLATFORM_GLOBALS = [
  ...new Set([...Object.keys(globals.node), ...Object.keys(globals.browser)]),
].filter((name) => !(name in globals.es2021));

// ESLint replaces (not merges) a rule set again in a later block, so each block lists every pattern.
const DEEP_IMPORT = {
  group: ["@heartroom/*/src/**"],
  message: "Import a package's public entry, not its files.",
};
const APPS_IMPORT = {
  group: ["**/apps/*", "**/apps/**", "@heartroom/web", "@heartroom/server"],
  message: "packages/* must not import apps/*.",
};
const NODE_IMPORT = { group: ["node:*"], message: "Engine and rules run in the browser too." };
const TS_ONLY_SYNTAX = [
  { selector: "TSEnumDeclaration", message: "Use an `as const` object and a union instead." },
  { selector: "TSModuleDeclaration[kind='namespace']", message: "Use ES modules instead." },
];

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/coverage/", "**/dist/", "**/.next/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Views and results must be assignable to `Json`, which interfaces are not; one style everywhere.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      // Conflicts with no-non-null-assertion: an `as T` after an index check is the clearer of the two.
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `as const` objects + unions instead (docs/engineering/backend.md).
      "no-restricted-syntax": ["error", ...TS_ONLY_SYNTAX],
      "no-restricted-imports": ["error", { patterns: [DEEP_IMPORT] }],
    },
  },
  {
    // Packages never reach into apps, and nothing imports deeper than a package's public entry.
    files: ["packages/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEEP_IMPORT, APPS_IMPORT] }],
    },
  },
  {
    // Engine and game rules are pure: no Node/DOM globals, no clock, no Math.random, no node: imports.
    files: [
      "packages/engine/src/**/*.ts",
      "packages/games/*/src/rules.ts",
      "packages/games/*/src/rules/**/*.ts",
    ],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": ["error", ...PLATFORM_GLOBALS.filter((name) => name !== "crypto")],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng." },
        { object: "Date", property: "now", message: "Rules have no clock; the room owns time." },
        {
          object: "performance",
          property: "now",
          message: "Rules have no clock; the room owns time.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Rules have no clock; the room owns time.",
        },
        ...TS_ONLY_SYNTAX,
      ],
      "no-restricted-imports": ["error", { patterns: [DEEP_IMPORT, APPS_IMPORT, NODE_IMPORT] }],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
