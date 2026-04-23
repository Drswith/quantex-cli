---
id: qtx-0014
title: Extend agent definitions with self-update commands and version probes
status: done
priority: medium
area: agents
depends_on:
  - qtx-0013
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/agent-update/spec.md
---

# Task: Extend agent definitions with self-update commands and version probes

## Goal

Move agent self-update commands and version probing rules into explicit definition fields.

## Context

The legacy addendum identifies `selfUpdate` and `versionProbe` as the missing definition-level hooks needed for consistent agent update behavior.

## Constraints

- Keep default version probing available where custom probes are unnecessary.
- Avoid introducing agent-specific behavior only in command code.

## Implementation Notes

- Extend `AgentDefinition` with self-update and version-probe metadata.
- Backfill supported agents incrementally.

## Done When

- Agent definition data can describe custom update commands and version probes.
- Command and service layers rely on definition metadata instead of scattered conventions.

## Non-Goals

- Completing every possible agent integration in one pass.
