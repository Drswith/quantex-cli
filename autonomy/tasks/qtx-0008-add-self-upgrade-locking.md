---
id: qtx-0008
title: Add locking for self-upgrade execution
status: planned
priority: medium
area: self
depends_on:
  - qtx-0006
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Add locking for self-upgrade execution

## Goal

Prevent concurrent self-upgrade runs from racing or corrupting local installation state.

## Context

The legacy backlog identifies concurrent upgrade execution as a core safety risk for the self-upgrade path.

## Constraints

- Locking must cover both success and failure paths.
- A second concurrent invocation should fail predictably.

## Implementation Notes

- Add a dedicated self-upgrade lock path.
- Return a typed `locked` error when the lock is already held.

## Done When

- Concurrent self-upgrade attempts are serialized or rejected safely.
- Lock cleanup behavior is reliable across failure paths.

## Non-Goals

- General-purpose locking for unrelated workflows.
