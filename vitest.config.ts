import { defineConfig } from "vitest/config";

// One Vitest run covers every workspace package. (Vitest 4+ replaced vitest.workspace.ts with `projects`.)
export default defineConfig({
  test: {
    projects: ["packages/*", "packages/games/*", "apps/*"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "packages/games/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
      thresholds: {
        "packages/engine/src/**": { branches: 90, functions: 90, lines: 90, statements: 90 },
      },
    },
  },
});
