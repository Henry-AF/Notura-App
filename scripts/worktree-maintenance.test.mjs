import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorktreeList, selectMergedWorktrees } from "./worktree-maintenance.mjs";

describe("worktree maintenance", () => {
  it("parses registered branches and ignores detached worktrees", () => {
    const result = parseWorktreeList(
      "worktree C:/repo\nHEAD abc\nbranch refs/heads/main\n\nworktree C:/repo/tmp\nHEAD def\ndetached\n",
    );

    expect(result).toEqual([
      { worktree: "C:/repo", HEAD: "abc", branch: "refs/heads/main" },
    ]);
  });

  it("selects only merged worktrees inside the managed directory", () => {
    const root = path.resolve("C:/repo");
    const inside = path.join(root, ".worktrees", "merged");
    const outside = path.resolve("C:/other");
    const worktrees = [
      { worktree: inside, branch: "refs/heads/merged" },
      { worktree: outside, branch: "refs/heads/merged" },
      { worktree: path.join(root, ".worktrees", "active"), branch: "refs/heads/active" },
    ];

    expect(selectMergedWorktrees(worktrees, new Set(["refs/heads/merged"]), root)).toEqual([
      worktrees[0],
    ]);
  });
});
