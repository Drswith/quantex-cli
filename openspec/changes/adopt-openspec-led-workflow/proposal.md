## Why

Quantex's initial project-memory experiment made agent-led work reviewable, but it also grew a repo-local task queue and helper scripts that duplicated capabilities now provided by OpenSpec and GitHub. The project needs one standard, agent-neutral workflow so Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, OpenCode, and future agents can move from discussion to implementation without depending on Quantex-specific project-management commands.

## What Changes

- Retire the active `autonomy/` task queue and repo-local scaffolding commands from the development workflow.
- Preserve completed `qtx-*` task history as archived OpenSpec changes under `openspec/changes/archive/`.
- Pin the official OpenSpec CLI as a project-local dev dependency and expose repo scripts for list, validation, status, show, new change, instructions, and archive operations.
- Initialize OPSX integrations for multiple coding agents: Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode.
- Add `openspec/config.yaml` so OpenSpec instructions receive Quantex-specific context and artifact rules.
- Update project memory, GitHub collaboration, runbook, ADR, PR template, and CI guidance to treat OpenSpec as the default contract for non-trivial behavior or durable-process changes.
- Keep GitHub issues and PRs as the executable work and merge-gating surfaces.
- Keep ADRs, runbooks, postmortems, and session summaries in `docs/` for durable decisions and operational knowledge.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: OpenSpec becomes the primary proposal and change-contract workflow for non-trivial behavior or durable-process changes; historical `qtx-*` task contracts are preserved as OpenSpec archive history.

## Impact

- Development workflow changes from a repo-local autonomy task system to OPSX actions and OpenSpec artifacts.
- New agent-specific OPSX skills and prompts are added for the supported coding agents.
- CI validates OpenSpec artifacts with `bun run openspec:validate`.
- The repo no longer exposes `task:new`, `adr:new`, or `worktree:new` package scripts.
- Historical task context remains accessible through `openspec/changes/archive/qtx-task-history.md`.
