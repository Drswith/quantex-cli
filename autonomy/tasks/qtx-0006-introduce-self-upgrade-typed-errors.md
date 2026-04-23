---
id: qtx-0006
title: Introduce typed errors for self-upgrade outcomes
status: planned
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

# Task: Introduce typed errors for self-upgrade outcomes

## Goal

Replace boolean-only self-upgrade results with structured outcomes and error kinds.

## Context

The legacy addendum calls out typed errors as the prerequisite for better recovery hints and safer diagnostics.

## Constraints

- Preserve existing successful upgrade flows.
- Keep the error model focused on self-upgrade semantics.

## Implementation Notes

- Define `UpgradeOutcome` and `UpgradeErrorKind`.
- Thread typed errors through providers, `upgrade`, and `doctor`.

## Done When

- Self-upgrade returns structured outcomes.
- Diagnostics can distinguish at least network, checksum, permission, locked, verify, unsupported, and unknown failures.

## Non-Goals

- Implementing checksum or verify behavior in the same task.
