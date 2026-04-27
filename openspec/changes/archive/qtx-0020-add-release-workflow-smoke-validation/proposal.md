# qtx-0020: Add release workflow smoke validation

> Migrated from `autonomy/tasks/qtx-0020-add-release-workflow-smoke-validation.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | release |
| Depends on | - |
| Human review | `suggested` |
| Docs to update | openspec/specs/self-upgrade/spec.md |

## Historical Task Contract

# Task: Add release workflow smoke validation

## Goal

Add release-time smoke validation so generated binaries and release metadata are checked before they are treated as publishable artifacts.

## Context

The release artifact pipeline exists, but the remaining backlog still calls for stronger smoke validation around produced binaries and metadata consistency.

## Constraints

- Reuse the current release-artifact flow instead of replacing it.
- Keep checks deterministic and CI-friendly.

## Implementation Notes

- Relevant files: `.github/workflows/`, `scripts/write-release-checksums.ts`, `scripts/generate-release-manifest.ts`, `scripts/verify-release-artifacts.ts`
- Relevant commands: `bun run release:artifacts`
- Relevant specs or ADRs: `openspec/specs/self-upgrade/spec.md`

## Done When

- CI validates the publishable artifacts with at least one smoke-level execution step.
- Release metadata mismatch or unusable binaries fail the workflow clearly.

## Non-Goals

- Redesigning the entire release process
