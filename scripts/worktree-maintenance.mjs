import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function parseWorktreeList(output) {
  return output
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => Object.fromEntries(block.split(/\r?\n/).map(parseLine)))
    .filter((entry) => entry.worktree && entry.branch);
}

function parseLine(line) {
  const separator = line.indexOf(" ");
  return separator === -1 ? [line, true] : [line.slice(0, separator), line.slice(separator + 1)];
}

export function selectMergedWorktrees(worktrees, mergedBranches, root) {
  const worktreeRoot = path.join(root, ".worktrees") + path.sep;
  return worktrees.filter(
    ({ worktree, branch }) =>
      path.resolve(worktree).startsWith(worktreeRoot) && mergedBranches.has(branch),
  );
}

function git(root, args) {
  return execFileSync("git", ["-c", "safe.directory=*", "-C", root, ...args], {
    encoding: "utf8",
  }).trim();
}

function findCandidates(root, mainRef) {
  const worktrees = parseWorktreeList(git(root, ["worktree", "list", "--porcelain"]));
  const merged = git(root, ["for-each-ref", "--format=%(refname)", `--merged=${mainRef}`, "refs/heads"]);
  return selectMergedWorktrees(worktrees, new Set(merged.split(/\r?\n/)), root);
}

function removeCleanWorktree(root, worktree) {
  if (git(worktree, ["status", "--porcelain"])) {
    console.log(`SKIP dirty: ${worktree}`);
    return;
  }

  git(root, ["worktree", "remove", worktree]);
  console.log(`REMOVED: ${worktree}`);
}

export function runMaintenance({ apply, mainRef = "origin/main", root = process.cwd() }) {
  const candidates = findCandidates(root, mainRef);
  if (candidates.length === 0) {
    console.log(`No worktrees merged into ${mainRef}.`);
    return;
  }

  for (const { worktree } of candidates) {
    if (apply) removeCleanWorktree(root, worktree);
    else console.log(`WOULD REMOVE: ${worktree}`);
  }
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntryPoint) {
  runMaintenance({ apply: process.argv.includes("--apply") });
}
