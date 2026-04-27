# qtx-0025: Make resolve surface machine-actionable install guidance

> Migrated from `autonomy/tasks/qtx-0025-make-resolve-surface-machine-actionable-install-guidance.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | surface |
| Depends on | - |
| Human review | `required` |
| Docs to update | openspec/specs/agent-update/spec.md, skills/quantex-cli/references/command-recipes.md |

## Historical Task Contract

# Task: Make resolve surface machine-actionable install guidance

## Goal

Make `quantex resolve` expose structured install guidance when an agent is not installed, so another agent can decide the next lifecycle action without falling back to prose-only errors.

## Context

The second autonomy round already strengthened `doctor --json`, but another common decision point is `resolve`: when an agent is missing, the caller still only gets a human-oriented error. Tightening this surface makes Quantex more useful as a runtime contract for future autonomous agent flows.

## Constraints

- Keep Quantex in lifecycle CLI scope.
- Preserve existing successful `resolve` behavior while enriching the missing-agent path.

## Implementation Notes

- Relevant files: `src/commands/resolve.ts`, `src/commands/schema.ts`, `test/commands/resolve.test.ts`
- Relevant commands: `quantex resolve <agent> --json`, `quantex schema resolve --json`
- Relevant specs or ADRs: `openspec/specs/agent-update/spec.md`

## Done When

- `resolve --json` exposes machine-actionable install guidance for missing agents.
- The `schema` command documents the enriched resolve contract.
- Tests cover the not-installed guidance path.

## Non-Goals

- Auto-installing from `resolve`
- Expanding Quantex into a workflow orchestrator
