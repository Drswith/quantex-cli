# qtx-0021: Write release and self-upgrade debugging runbook

> Migrated from `autonomy/tasks/qtx-0021-write-release-and-self-upgrade-debugging-runbook.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | docs |
| Depends on | - |
| Human review | `suggested` |
| Docs to update | docs/runbooks/, docs/README.md |

## Historical Task Contract

# Task: Write release and self-upgrade debugging runbook

## Goal

Document the contributor workflow for reproducing, debugging, and validating release-artifact and self-upgrade issues.

## Context

The project now has more release and upgrade machinery than a casual contributor can infer from code alone. A stable runbook will reduce re-discovery during future agent-led maintenance.

## Constraints

- Prefer concrete commands from the current repo over abstract guidance.
- Keep the runbook focused on debugging and validation, not general contribution onboarding.

## Implementation Notes

- Relevant files: `docs/runbooks/`, release scripts, `src/self/`
- Relevant commands: `bun run build:bin`, `bun run release:artifacts`, `quantex upgrade --check`
- Relevant specs or ADRs: `openspec/specs/self-upgrade/spec.md`

## Done When

- Contributors can follow one runbook to inspect release artifacts and self-upgrade behavior locally.
- The docs point to the canonical validation commands and common failure symptoms.

## Non-Goals

- Full release automation redesign
