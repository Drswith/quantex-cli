---
id: qtx-0013
title: Introduce managed, self-update, and manual-hint agent update layers
status: planned
priority: high
area: agents
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/agent-update/spec.md
  - docs/adr/0002-keep-self-upgrade-and-agent-update-separate.md
---

# Task: Introduce managed, self-update, and manual-hint agent update layers

## Goal

Model agent update strategy explicitly as managed, self-update, and manual-hint layers.

## Context

The legacy scope notes define this model as the long-term agent update architecture, but the canonical artifacts did not yet capture it as executable work.

## Constraints

- Preserve the rule that recorded actual install source takes priority.
- Do not blur agent update and self-upgrade semantics.

## Implementation Notes

- Add an agent update provider registry.
- Keep state-driven strategy selection ahead of definition-driven fallback.

## Done When

- Agent update behavior is explained through explicit strategy layers.
- The new strategy model is reusable by both single-agent and batch updates.

## Non-Goals

- Refactoring Quantex self-upgrade into the same provider hierarchy.
