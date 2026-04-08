# Code Quality Rules

## Goal

This project uses a gradual lint rollout: new or changed TypeScript files should follow the stricter rules now, while the legacy tree can be brought into compliance over time.

## Automatically Enforced Today

Strict lint is applied through `npm run lint:strict` and `npm run lint:changed`.

Current enforced rules for TypeScript files in `src/` and `tests/` include:

- Maximum cyclomatic complexity of `10`
- Maximum function length of `80` lines, ignoring blank lines and comments
- Maximum of `4` parameters as a warning, with warnings treated as failing in strict mode
- `@typescript-eslint/no-unnecessary-condition`
- `@typescript-eslint/no-unnecessary-type-assertion`
- `@typescript-eslint/no-unnecessary-type-arguments`

## TypeScript Style Direction

The lint setup is intentionally aligned with these principles:

- Prefer small, composable functions
- Trust the type system instead of adding redundant defensive checks
- Avoid encouraging optional chaining or nullish coalescing by default when types already guarantee the value

Because not every nuance can be enforced reliably with off-the-shelf ESLint rules, some expectations remain team guidelines for now.

## Current Human Guidelines

These are expected in new code even where the linter does not prove them perfectly yet:

- Do not use optional chaining on values that are already non-nullable
- Do not use nullish coalescing when the value is guaranteed to exist
- Avoid overly defensive patterns unless the runtime contract truly requires them
- Favor clarity and correctness over code that only looks "safe"

## Scripts

- `npm run lint`
  Runs the project's standard Next.js lint pass.

- `npm run lint:strict -- <files...>`
  Runs the stricter TypeScript-aware rules against specific files.

- `npm run lint:changed`
  Runs strict lint only on changed or untracked TypeScript files within `src/` and `tests/`.

## Rollout Plan

The strict rules are intended to protect new work first, especially code written by agents. As the codebase improves, more existing files can be brought under the strict workflow until the stricter policy becomes the normal project baseline.
