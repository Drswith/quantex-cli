# qtx-0028: Replace bumpp with merge-to-main auto release

> Migrated from `autonomy/tasks/qtx-0028-replace-bumpp-with-merge-to-main-auto-release.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | workflow |
| Depends on | - |
| Human review | `required` |
| Docs to update | docs/runbooks/releasing-quantex.md, docs/github-collaboration.md, docs/releases.md |

## Historical Task Contract

# Task: Replace bumpp with merge-to-main auto release

## Goal

Quantex should release automatically from merged commits on `main`, with GitHub Releases as the only canonical changelog and no `bumpp`-driven release preparation step.

## Context

The previous release redesign still required a release-preparation command and release PR. That does not match the intended workflow where normal task PRs merge to `main` and publishing happens automatically afterward.

## Constraints

- Do not reintroduce a rolling repository `CHANGELOG.md`.
- Keep GitHub Releases as the canonical release history.
- Preserve build, artifact, smoke, npm, and GitHub Release publication in the automated path.

## Implementation Notes

- Remove `bumpp` from the mainline release path.
- Trigger release automation from CI success on `main`.
- Use merged commit metadata to decide release version and GitHub release notes.

## Done When

- merging release-worthy commits to `main` can publish a new version without any local release command
- GitHub Releases is documented as the canonical changelog location

## Non-Goals

- Maintaining a rolling `CHANGELOG.md` in the repository
- Keeping `bumpp` as part of the normal release path
