---
id: qtx-0009
title: Add post-upgrade verification and minimal rollback
status: planned
priority: medium
area: self
depends_on:
  - qtx-0007
  - qtx-0008
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Add post-upgrade verification and minimal rollback

## Goal

Verify that a newly upgraded Quantex binary is runnable and recover the previous binary when verification fails.

## Context

The legacy addendum treats post-upgrade verify plus single-backup rollback as the minimum release-grade safety bar after replacement.

## Constraints

- Keep rollback minimal: one `.bak`, not full version history.
- Support Windows through delayed replacement semantics.

## Implementation Notes

- Spawn the upgraded binary for `--version` verification.
- Keep a single backup around the replacement boundary.
- Roll back on verify failure.

## Done When

- Successful upgrades verify the new binary.
- Failed verification restores the previous binary and reports a typed error.

## Non-Goals

- Multi-version rollback history.
