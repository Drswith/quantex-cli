---
id: qtx-0027
title: Make release flow compatible with PR-only main
status: done
priority: high
area: workflow
depends_on: []
human_review: required
checks:
  - bun run memory:check
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/releasing-quantex.md
  - docs/github-collaboration.md
---

# Task: Make release flow compatible with PR-only main

## Goal

Quantex should have a release procedure that still uses `bumpp` for version selection while remaining compatible with a PR-only `main` branch.

## Context

The old release flow assumed a local version bump commit could tag and push directly from `main`. Repository protections now require all `main` updates to go through PRs, so release preparation and release publication must be split into separate steps.

## Constraints

- Keep the existing tag-triggered publish workflow in `.github/workflows/release.yml`.
- Do not introduce a fake one-click workflow that silently bypasses branch protections or depends on `GITHUB_TOKEN` to trigger another workflow.

## Implementation Notes

- Update package scripts so `bun run release` is safe under the new rules.
- Add a helper for creating the release tag from merged `main`.
- Document the new release flow in a canonical runbook and in GitHub collaboration guidance.

## Done When

- `bun run release` prepares a reviewable version bump without tagging or pushing.
- maintainers have a documented and guarded way to tag the merged `main` commit and trigger the publish workflow.

## Non-Goals

- Replacing `bumpp`
- Building a fully automated one-click release service
