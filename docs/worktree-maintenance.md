# Worktree maintenance

The `.worktrees/` directory is reserved for temporary or active worktrees of
this repository. Independent repositories such as `notura-landing` and
`notura-triage` must live beside `Notura-App`, never inside `.worktrees/`.

Run the audit after updating remote references:

```powershell
git fetch origin --prune
npm run worktrees:clean
```

The command is a dry run by default. It lists only registered worktrees under
`.worktrees/` whose local branch is already merged into `origin/main`. Review
the list, then apply the cleanup:

```powershell
npm run worktrees:clean -- --apply
git worktree list
```

The apply mode calls `git worktree remove` only for clean worktrees. Dirty
worktrees are reported and preserved for manual review. Detached worktrees and
directories outside this repository's `.worktrees/` directory are never
selected automatically.

Do not schedule apply mode as an unattended job: branch integration and local
changes should always be reviewed by a developer first.
