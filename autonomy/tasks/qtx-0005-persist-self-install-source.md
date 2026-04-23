---
id: qtx-0005
title: Persist self install source in state
status: done
priority: high
area: self
depends_on:
  - qtx-0004
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Persist self install source in state

## Goal

Make self install-source detection prefer persisted state with runtime reconciliation as fallback.

## Context

The legacy scope notes call out `state.self.installSource` as a missing durable input for reliable self-upgrade behavior.

## Constraints

- Keep runtime path inspection as a fallback.
- Do not break existing installs that have no persisted state yet.

## Implementation Notes

- Extend state storage with `self.installSource`.
- Write install source during install/postinstall paths where possible.
- Reconcile drift between state and runtime detection.

## Done When

- Self install source is persisted in state.
- Inspection prefers state and refreshes stale values safely.

## Non-Goals

- Refactoring agent state storage in the same task.
