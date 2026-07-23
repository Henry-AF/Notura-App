import { configDefaults, defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-upstash-rate-limit.ts"],
    // mobile/ is a separate Expo package with its own tsconfig (extends
    // expo/tsconfig.base, only installed under mobile/node_modules) and its
    // own Jest runner — vitest must never try to collect its tests.
    exclude: [...configDefaults.exclude, "mobile/**"],
  },
});
