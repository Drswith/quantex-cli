# qtx-0010: Adopt release manifest and explicit self-upgrade channels

> Migrated from `autonomy/tasks/qtx-0010-adopt-release-manifest-and-channel-selection.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | self |
| Depends on | qtx-0007 |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Adopt release manifest and explicit self-upgrade channels

## Goal

Move binary self-upgrade from hard-coded asset selection to manifest-driven selection with explicit channel support.

## Context

The legacy scope and addendum both call out release metadata and channel selection as the path from MVP behavior to release-grade upgrade support.

## Constraints

- Keep upgrade checks explicit and user-invoked.
- Support stable and beta selection without passive background behavior.

## Implementation Notes

- Introduce manifest-driven asset selection.
- Support `quantex upgrade --check` and channel-aware selection paths.
- Reuse existing configuration semantics where possible.

## Done When

- Binary asset selection comes from release metadata rather than name guessing.
- Explicit channel selection works for check and upgrade flows.

## Non-Goals

- Passive startup update checks.
