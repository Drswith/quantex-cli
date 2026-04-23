---
id: qtx-0002
title: Consolidate auto-upgrade design into OpenSpec specs and ADRs
status: done
priority: high
area: docs
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - openspec/specs/
  - docs/adr/
  - autonomy/tasks/
---

# Task: Consolidate auto-upgrade design into OpenSpec specs and ADRs

## Goal

Turn the legacy auto-upgrade scope and addendum documents into canonical artifacts that distinguish current behavior from durable decisions and future work.

## Context

`AUTO_UPGRADE_SCOPE.md`, `AUTO_UPGRADE_SCOPE_ADDENDUM.md`, and `AUTO_UPGRADE_IMPLEMENTATION_BACKLOG.md` currently mix architecture, non-goals, and pending work in root documents.

## Constraints

- Preserve current useful detail during migration.
- Avoid collapsing current behavior, decision rationale, and backlog into one replacement document.

## Implementation Notes

- Create OpenSpec source-of-truth specs for current self-upgrade and agent-update behavior.
- Extract long-lived policies and non-goals into one or more ADRs.
- Convert remaining backlog items into autonomy tasks.

## Done When

- Current behavior is represented in `openspec/specs/`.
- Durable decisions are represented in ADRs.
- Open backlog items no longer depend on root markdown documents.

## Non-Goals

- Implementing the remaining auto-upgrade features themselves.
