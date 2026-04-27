# qtx-0005: Persist self install source in state

> Migrated from `autonomy/tasks/qtx-0005-persist-self-install-source.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | self |
| Depends on | qtx-0004 |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Persist self install source in state

## Goal

Make self install-source detection prefer persisted state with runtime reconciliation as fallback.

## Context

The legacy scope notes call out `state.self.installSource` as a missing durable input for reliable self-upgrade behavior.

## Constraints

- Keep runtime path inspection as a fallback.
- Do not break existing installs that have no persisted state yet.

## Implementation Notes

- Extend state storage with `self.installSource`.
- Write install source during install/postinstall paths where possible.
- Reconcile drift between state and runtime detection.

## Done When

- Self install source is persisted in state.
- Inspection prefers state and refreshes stale values safely.

## Non-Goals

- Refactoring agent state storage in the same task.
