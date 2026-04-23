---
id: qtx-0017
title: Improve update and upgrade lifecycle summaries
status: ready
priority: medium
area: ux
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - openspec/specs/agent-update/spec.md
  - openspec/specs/self-upgrade/spec.md
---

# Task: Improve update and upgrade lifecycle summaries

## Goal

Make human-mode `update` and `upgrade` output easier to scan when operations succeed, partially fail, or fall back to manual action.

## Context

The lifecycle core is already in place, but the remaining UX work in `TODO.md` is mainly about making results clearer without weakening the machine-readable contract.

## Constraints

- Preserve JSON and NDJSON result shapes.
- Keep the command semantics unchanged; this task is presentation-oriented.

## Implementation Notes

- Relevant files: `src/commands/update.ts`, `src/commands/upgrade.ts`, related tests
- Relevant commands: `quantex update <agent>`, `quantex update --all`, `quantex upgrade`
- Relevant specs or ADRs: `openspec/specs/agent-update/spec.md`, `openspec/specs/self-upgrade/spec.md`

## Done When

- Human output distinguishes success, manual-required, and failure cases more clearly.
- Summary output for batch update is easier to understand at a glance.

## Non-Goals

- Changing the stable structured result envelope
