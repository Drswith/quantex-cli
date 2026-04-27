# qtx-0014: Extend agent definitions with self-update commands and version probes

> Migrated from `autonomy/tasks/qtx-0014-extend-agent-definitions-for-self-update-and-version-probes.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | agents |
| Depends on | qtx-0013 |
| Human review | `required` |
| Docs to update | openspec/specs/agent-update/spec.md |

## Historical Task Contract

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
