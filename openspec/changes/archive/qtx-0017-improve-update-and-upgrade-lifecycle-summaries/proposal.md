# qtx-0017: Improve update and upgrade lifecycle summaries

> Migrated from `autonomy/tasks/qtx-0017-improve-update-and-upgrade-lifecycle-summaries.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | ux |
| Depends on | - |
| Human review | `suggested` |
| Docs to update | openspec/specs/agent-update/spec.md, openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

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
