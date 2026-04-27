# qtx-0012: Align release pipeline with manifest and checksum metadata

> Migrated from `autonomy/tasks/qtx-0012-align-release-pipeline-with-upgrade-metadata.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | release |
| Depends on | - |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Align release pipeline with manifest and checksum metadata

## Goal

Make the release pipeline publish the metadata required by release-grade self-upgrade flows.

## Context

The legacy backlog separates client work from release-pipeline work so manifest and checksum artifacts can become trustworthy source-of-truth inputs.

## Constraints

- Published metadata must match the release assets.
- Pipeline changes should not silently desync npm, bun, and binary release outputs.

## Implementation Notes

- Ensure release builds emit manifest and checksum artifacts consistently.
- Add validation that published metadata matches produced assets.

## Done When

- Releases publish machine-readable manifest and checksum artifacts.
- Pipeline validation catches asset and metadata mismatches.

## Non-Goals

- Reworking the entire release process outside upgrade metadata needs.
