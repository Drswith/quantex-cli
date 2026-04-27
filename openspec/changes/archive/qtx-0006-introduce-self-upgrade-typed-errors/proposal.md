# qtx-0006: Introduce typed errors for self-upgrade outcomes

> Migrated from `autonomy/tasks/qtx-0006-introduce-self-upgrade-typed-errors.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

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

# Task: Introduce typed errors for self-upgrade outcomes

## Goal

Replace boolean-only self-upgrade results with structured outcomes and error kinds.

## Context

The legacy addendum calls out typed errors as the prerequisite for better recovery hints and safer diagnostics.

## Constraints

- Preserve existing successful upgrade flows.
- Keep the error model focused on self-upgrade semantics.

## Implementation Notes

- Define `UpgradeOutcome` and `UpgradeErrorKind`.
- Thread typed errors through providers, `upgrade`, and `doctor`.

## Done When

- Self-upgrade returns structured outcomes.
- Diagnostics can distinguish at least network, checksum, permission, locked, verify, unsupported, and unknown failures.

## Non-Goals

- Implementing checksum or verify behavior in the same task.
