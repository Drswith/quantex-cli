# qtx-0007: Add checksum validation for binary self-upgrade

> Migrated from `autonomy/tasks/qtx-0007-add-binary-checksum-validation.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | self |
| Depends on | qtx-0006 |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Add checksum validation for binary self-upgrade

## Goal

Ensure downloaded self-upgrade binaries are verified before replacement.

## Context

Checksum validation is one of the main missing safety guarantees captured in the legacy auto-upgrade scope.

## Constraints

- Do not overwrite the installed executable with an unverified payload.
- Keep the design reusable for future manifest-driven release metadata.

## Implementation Notes

- Add reusable download-and-verify utilities.
- Surface checksum failures as typed upgrade errors.

## Done When

- Binary self-upgrade validates checksums before replacement.
- Checksum mismatch aborts the upgrade and reports a typed failure.

## Non-Goals

- Full release manifest support.
