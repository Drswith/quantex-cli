# ADR 0004: Standardize Worktree-First Task Execution

- Status: Accepted
- Date: 2026-04-24

## Context

Quantex is being developed through human plus agent collaboration, and the implementation loop now relies on explicit task contracts, protected branches, release PRs, and increasingly autonomous execution.

Switching branches inside a single shared working directory has three recurring costs:

- it disrupts the user's current IDE context and branch position
- it makes parallel task execution harder and riskier
- it increases the chance of mixing task work with `main`, `beta`, or automation-managed release branches

As the project moves toward more agent-led iteration, workspace isolation needs to become a durable process rule rather than an informal preference.

## Decision

Quantex standardizes on worktree-first task execution for implementation work that is expected to create commits or a PR.

- Read-only inspection may still happen in the current workspace.
- PR-bound implementation should use a dedicated git worktree by default.
- Worktrees are required when the current workspace is dirty, when multiple tasks may proceed in parallel, or when the user's primary workspace should remain on another branch.
- Quantex provides a helper command, `bun run worktree:new`, to scaffold a task worktree using the preferred naming convention.

## Consequences

- The user's main workspace can stay stable while task branches evolve elsewhere.
- Parallel agent work becomes safer and easier to reason about.
- Task execution now has an explicit isolation boundary that future agents can follow.
- Contributors need to manage extra filesystem directories and clean up merged worktrees.
- Worktrees do not replace branches; they are the standard way to host task branches.

## Alternatives Considered

- Keep using a single workspace and switch branches in place.
- Use multiple full clones instead of git worktrees.
- Leave worktree usage as an informal recommendation instead of a project rule.

## Follow-up

- Update the GitHub collaboration flow and autonomy guidance to point implementation work at dedicated worktrees.
- Publish a runbook that explains setup, verification, cleanup, and escalation for worktree-backed task execution.
- Keep task scaffolding and helper commands low-friction so the standard flow is easier to follow than ad hoc branch switching.
