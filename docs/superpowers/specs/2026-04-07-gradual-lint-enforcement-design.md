# Gradual Lint Enforcement Design

**Date:** 2026-04-07
**Status:** Approved for implementation

## Goal

Add a real lint configuration that enforces the project's new code-quality and TypeScript discipline rules for new or changed code, without blocking the entire legacy codebase immediately.

## Scope

### In scope

- Add an explicit ESLint configuration to the project
- Enforce function size and cyclomatic complexity limits
- Enforce TypeScript rules that reduce unnecessary defensive coding
- Introduce a gradual rollout model focused on new or changed files
- Add scripts that agents and humans can run consistently
- Document the rollout and the enforced rules for future AGENTS.md alignment

### Out of scope

- Making the entire existing codebase conform in this task
- Writing a custom ESLint rule to perfectly detect every unnecessary `?.` or `??`
- Adding pre-commit hooks in this round
- Reformatting or refactoring unrelated legacy files only to satisfy the new policy

## Current Context

The project currently uses `next lint` implicitly through the `lint` script in `package.json`, but there is no explicit ESLint configuration file in the repository. That means there is no stable place to encode the new gradual policy or to separate strict linting for new code from broader linting for the legacy tree.

## Proposed Architecture

Introduce an explicit ESLint config that extends the Next.js baseline and layers in TypeScript-aware rules. The rollout will use two execution modes:

1. A general lint mode for the repository baseline
2. A strict lint mode aimed at newly created or changed TypeScript files

The strict mode will be the default recommendation for agent-created code, while the broader lint mode remains available for project-wide visibility.

## Enforced Rules

### Code Quality Rules

- `complexity`: error when above `10`
- `max-lines-per-function`: error above `80`, ignoring comments and blank lines
- `max-params`: warning above `4`

These rules encourage smaller, more composable functions and discourage multi-responsibility handlers.

### TypeScript Strictness Rules

- `@typescript-eslint/no-unnecessary-condition`: error
- `@typescript-eslint/no-unnecessary-type-assertion`: error
- `@typescript-eslint/no-unnecessary-type-arguments`: error
- `@typescript-eslint/prefer-optional-chain`: disabled
- `@typescript-eslint/prefer-nullish-coalescing`: disabled

These choices align the lint setup with the desired style: trust the type system and avoid defensive patterns that only look safe.

### AI Code Guidelines

The initial enforcement for AI-oriented style will be indirect rather than custom:

- reject unnecessary conditional logic through TypeScript-aware linting
- reject oversized or overly complex functions through structural rules
- avoid enabling rules that aggressively push optional chaining or nullish coalescing

The guidelines remain partially documentary in this first round because the more nuanced variants would require custom lint rules to enforce reliably.

## Gradual Rollout Strategy

### `lint`

Keep a project-wide lint script so the team still has a general repository signal.

### `lint:strict`

Add a stricter lint command that targets the source files relevant to new work, especially `src/**/*.ts` and `src/**/*.tsx`.

### `lint:changed`

Add a command that computes files changed relative to `main` and runs the strict lint only on those TypeScript files.

This is the core gradual enforcement path for new code and agent-generated changes.

## Script Strategy

Use direct `eslint` CLI invocations instead of relying only on `next lint`, because:

- they are easier to scope to changed files
- they work better for strict, file-targeted enforcement
- they make rule ownership clearer

`next lint` can still remain available through the same underlying config if needed.

## Testing Strategy

Follow a small TDD cycle around the lint policy:

1. Create lint fixtures containing one compliant example and one violating example
2. Add a focused test script or invocation that proves the violating example fails under strict lint
3. Run it first and confirm failure
4. Implement ESLint config and scripts
5. Re-run the strict lint against the fixtures and confirm the pass/fail behavior is correct

## Documentation

Add a concise documentation file describing:

- which rules are automatically enforced now
- which rules are still guidelines
- how `lint:strict` and `lint:changed` should be used
- how this is intended to evolve into future AGENTS.md instructions

## Tradeoffs

### Benefits

- Real automated guardrails for new code
- Minimal disruption to the legacy codebase
- Clear path to tighten enforcement over time
- Good fit for agent workflows

### Costs

- Requires extra ESLint TypeScript dependencies
- Some desired style rules remain approximations instead of perfect enforcement
- `lint:changed` depends on git diff context and branch discipline
