# Proposal: Adopt OpenSpec-Led Workflow

## Summary

Use OpenSpec-compatible changes as the default proposal and task contract for non-trivial behavior or durable-process changes. Retire the repo-local autonomy task system so Quantex stores project memory without growing a second project-management CLI inside the product repository.

## Problem

The initial project-memory experiment successfully made agent-led development reviewable and release-safe. It also introduced custom scaffolding commands and a task queue that began to duplicate workflow capabilities better handled by OpenSpec, GitHub, and CI.

That creates a nested-CLI smell: Quantex is itself a CLI product, while the repo is accumulating a separate CLI-like management layer only for developing Quantex.

## Goals

- Make OpenSpec the standard entry point for non-trivial behavior and durable-process changes.
- Pin the official OpenSpec CLI as a project-local development dependency instead of relying on global installs.
- Keep GitHub issues and PRs as executable work and merge-gating surfaces.
- Keep ADRs and runbooks for durable decisions and recovery knowledge.
- Preserve completed `qtx-*` task history as OpenSpec archived changes.
- Remove `autonomy/`, `task:new`, `adr:new`, and `worktree:new` from the active workflow surface.

## Non-Goals

- Rewrite every historical task body into a new format.
- Remove release automation, PR governance, or GitHub App release bot flow.
- Require OpenSpec for tiny fixes, typo corrections, or mechanical maintenance.
- Replace GitHub issues, PRs, CI, or release-please.
