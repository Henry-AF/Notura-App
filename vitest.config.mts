import { configDefaults, defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-upstash-rate-limit.ts"],
    // mobile/ is a separate Expo package with its own tsconfig (extends
    // expo/tsconfig.base, only installed under mobile/node_modules) and its
    // own Jest runner — vitest must never try to collect its tests.
    // There are two distinct worktree directories: `.worktrees/` (manual,
    // developer-created worktrees) and `.claude/worktrees/` (created
    // automatically by Claude Code agents). They are sibling directories,
    // not one a prefix of the other — excluding only one leaves the other's
    // test files collected. NOT-176 excluded `.worktrees/**` but missed
    // `.claude/worktrees/**`, which is fixed here (NOT-189).
    exclude: [
      ...configDefaults.exclude,
      "mobile/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
    ],
  },
});
