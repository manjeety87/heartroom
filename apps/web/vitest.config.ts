import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

// The app imports through the `@/` alias (tsconfig paths); tests resolve it the same way.
export default defineProject({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
