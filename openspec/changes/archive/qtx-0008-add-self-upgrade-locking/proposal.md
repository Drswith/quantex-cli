# qtx-0008: Add locking for self-upgrade execution

> Migrated from `autonomy/tasks/qtx-0008-add-self-upgrade-locking.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | self |
| Depends on | qtx-0006 |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Add locking for self-upgrade execution

## Goal

Prevent concurrent self-upgrade runs from racing or corrupting local installation state.

## Context

The legacy backlog identifies concurrent upgrade execution as a core safety risk for the self-upgrade path.

## Constraints

- Locking must cover both success and failure paths.
- A second concurrent invocation should fail predictably.

## Implementation Notes

- Add a dedicated self-upgrade lock path.
- Return a typed `locked` error when the lock is already held.

## Done When

- Concurrent self-upgrade attempts are serialized or rejected safely.
- Lock cleanup behavior is reliable across failure paths.

## Non-Goals

- General-purpose locking for unrelated workflows.
