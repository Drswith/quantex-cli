---
id: qtx-0010
title: Adopt release manifest and explicit self-upgrade channels
status: done
priority: medium
area: self
depends_on:
  - qtx-0007
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Adopt release manifest and explicit self-upgrade channels

## Goal

Move binary self-upgrade from hard-coded asset selection to manifest-driven selection with explicit channel support.

## Context

The legacy scope and addendum both call out release metadata and channel selection as the path from MVP behavior to release-grade upgrade support.

## Constraints

- Keep upgrade checks explicit and user-invoked.
- Support stable and beta selection without passive background behavior.

## Implementation Notes

- Introduce manifest-driven asset selection.
- Support `quantex upgrade --check` and channel-aware selection paths.
- Reuse existing configuration semantics where possible.

## Done When

- Binary asset selection comes from release metadata rather than name guessing.
- Explicit channel selection works for check and upgrade flows.

## Non-Goals

- Passive startup update checks.
