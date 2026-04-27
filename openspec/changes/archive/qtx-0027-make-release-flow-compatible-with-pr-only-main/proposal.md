# qtx-0027: Make release flow compatible with PR-only main

> Migrated from `autonomy/tasks/qtx-0027-make-release-flow-compatible-with-pr-only-main.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | workflow |
| Depends on | - |
| Human review | `required` |
| Docs to update | docs/runbooks/releasing-quantex.md, docs/github-collaboration.md |

## Historical Task Contract

# Task: Make release flow compatible with PR-only main

## Goal

Quantex should have a release procedure that still uses `bumpp` for version selection while remaining compatible with a PR-only `main` branch, without requiring a post-merge local publish step.

## Context

The old release flow assumed a local version bump commit could tag and push directly from `main`. Repository protections now require all `main` updates to go through PRs, so release preparation must happen in a PR and release publication must happen from trusted automation after merge.

## Constraints

- Keep release commits reviewable through PRs.
- Do not depend on `GITHUB_TOKEN` pushing a tag in one workflow to trigger a second publish workflow.

## Implementation Notes

- Update package scripts so `bun run release` is safe under the new rules.
- Keep `bun run release` ergonomic for humans.
- Publish automatically from GitHub Actions after the release PR merges.
- Document the new release flow in a canonical runbook and in GitHub collaboration guidance.

## Done When

- `bun run release` prepares a reviewable release PR without tagging or publishing.
- merging that PR to `main` automatically tags and publishes the release.

## Non-Goals

- Replacing `bumpp`
- Bypassing PR review for release version bumps
