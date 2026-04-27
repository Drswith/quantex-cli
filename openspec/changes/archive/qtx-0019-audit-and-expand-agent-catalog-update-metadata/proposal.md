# qtx-0019: Audit and expand agent catalog update metadata

> Migrated from `autonomy/tasks/qtx-0019-audit-and-expand-agent-catalog-update-metadata.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | agents |
| Depends on | - |
| Human review | `suggested` |
| Docs to update | openspec/specs/agent-update/spec.md |

## Historical Task Contract

# Task: Audit and expand agent catalog update metadata

## Goal

Audit the current agent catalog and close the highest-value gaps in `selfUpdate`, `versionProbe`, package names, and homepage metadata.

## Context

Future autonomous work depends on the registry being trustworthy. The remaining backlog items are less about new architecture and more about keeping catalog metadata accurate.

## Constraints

- Focus on the supported agent set rather than expanding into every possible integration.
- Prefer explicit metadata in definitions over command-layer special cases.

## Implementation Notes

- Relevant files: `src/agents/definitions/`, agent update tests
- Relevant commands: `quantex inspect <agent>`, `quantex update <agent>`
- Relevant specs or ADRs: `openspec/specs/agent-update/spec.md`

## Done When

- The main supported agents have reviewed update metadata.
- Any remaining catalog gaps are narrowed to explicit follow-up tasks or comments.

## Non-Goals

- Adding unrelated workflow-orchestration style features
