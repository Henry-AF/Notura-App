import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const eslintPackageRoot = dirname(dirname(require.resolve("eslint")));
const eslintCliPath = join(eslintPackageRoot, "bin", "eslint.js");

function readLines(command, args) {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getBranchName() {
  const [branchName = ""] = readLines("git", ["branch", "--show-current"]);
  return branchName;
}

function getMergeBase() {
  const [mergeBase = ""] = readLines("git", ["merge-base", "HEAD", "main"]);
  return mergeBase;
}

function isLintableTypeScriptFile(filePath) {
  return (
    (filePath.startsWith("src/") || filePath.startsWith("tests/")) &&
    !filePath.startsWith("tests/lint-fixtures/") &&
    /\.(ts|tsx)$/.test(filePath) &&
    !filePath.endsWith(".d.ts")
  );
}

const changedFiles = new Set();
const currentBranch = getBranchName();
const mergeBase = getMergeBase();

if (currentBranch && currentBranch !== "main" && mergeBase) {
  for (const filePath of readLines("git", [
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    `${mergeBase}...HEAD`,
    "--",
  ])) {
    changedFiles.add(filePath);
  }
}

for (const filePath of readLines("git", [
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  "HEAD",
  "--",
])) {
  changedFiles.add(filePath);
}

for (const filePath of readLines("git", [
  "diff",
  "--cached",
  "--name-only",
  "--diff-filter=ACMR",
  "--",
])) {
  changedFiles.add(filePath);
}

for (const filePath of readLines("git", [
  "ls-files",
  "--others",
  "--exclude-standard",
])) {
  changedFiles.add(filePath);
}

const lintTargets = [...changedFiles]
  .filter(isLintableTypeScriptFile)
  .sort((left, right) => left.localeCompare(right));

if (lintTargets.length === 0) {
  console.log("No changed TypeScript files matched the strict lint scope.");
  process.exit(0);
}

execFileSync(
  process.execPath,
  [
    eslintCliPath,
    "--config",
    ".eslintrc.strict.cjs",
    "--max-warnings=0",
    "--no-error-on-unmatched-pattern",
    ...lintTargets,
  ],
  {
    stdio: "inherit",
  }
);
