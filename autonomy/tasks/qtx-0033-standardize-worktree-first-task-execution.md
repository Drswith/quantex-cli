---
id: qtx-0033
title: Standardize worktree-first task execution
status: done
priority: high
area: workflow
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - autonomy/README.md
  - autonomy/policy.md
  - docs/README.md
  - autonomy/tasks/README.md
  - docs/github-collaboration.md
  - docs/runbooks/README.md
  - docs/runbooks/worktree-task-execution.md
  - docs/adr/0004-standardize-worktree-first-task-execution.md
---

# Task: Standardize worktree-first task execution

## Goal

Task implementation that is expected to produce commits or a PR should default to a dedicated git worktree, with one canonical helper command and one canonical runbook that future agents can follow.

## Context

Quantex has already adopted task contracts, protected branches, release PRs, and agent-driven execution. Continuing to implement those tasks by repeatedly switching the user's active workspace adds avoidable friction and risk.

If worktree-backed execution remains only a conversational preference, future agents may fall back to branch switching in place. The rule needs to become durable project memory and low-friction tooling.

## Constraints

- Keep the existing branch-and-PR governance model; worktrees should host branches rather than replace them.
- Do not add destructive cleanup automation that could remove a worktree with unmerged commits.
- Keep the helper command lightweight and dependency-free beyond the existing Bun script environment.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/28
- Relevant files: `scripts/new-worktree.ts`, `package.json`, `docs/github-collaboration.md`, `autonomy/README.md`, `autonomy/policy.md`, `docs/runbooks/worktree-task-execution.md`, `docs/adr/0004-standardize-worktree-first-task-execution.md`
- Relevant commands: `bun run worktree:new`, `git worktree list`, `git worktree remove`, `git worktree prune`
- Relevant specs or ADRs: `docs/adr/0004-standardize-worktree-first-task-execution.md`

## Done When

- `bun run worktree:new` can scaffold a dedicated task worktree with sensible default branch and path names.
- The collaboration, autonomy, and runbook entry points all describe worktree-first implementation consistently.
- A durable ADR records when worktrees are required versus optional.

## Verification Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/28
- Local checks passed: `bun run memory:check`, `bun run lint`, `bun run typecheck`
- Smoke test created and removed a disposable worktree successfully:
  - `bun run worktree:new -- --task qtx-0999 --title "Worktree smoke" --branch codex/qtx-0999-worktree-smoke --path ../quantex-cli-qtx-0999-worktree-smoke --base main`
  - `git -C ../quantex-cli-qtx-0999-worktree-smoke status --short --branch`
  - `git worktree remove ../quantex-cli-qtx-0999-worktree-smoke`
  - `git branch -D codex/qtx-0999-worktree-smoke`
  - `git worktree prune`

## Non-Goals

- Replacing branches with a new workflow model.
- Automatically deleting arbitrary worktrees or branches.
