---
id: qtx-0038
title: Verify stable release automation
status: done
priority: high
area: release
depends_on:
  - qtx-0037
human_review: required
checks:
  - bun run memory:check
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - autonomy/queue.md
---

# Task: Verify stable release automation

## Goal

Run a real stable patch release through the normal PR, release-please Release PR, Release PR automerge, npm trusted publishing, and GitHub Release artifact upload path.

## Context

The GitHub App release bot has been installed and the release workflows now mint short-lived installation tokens. A non-release `main` push proved the token can run release-please, but it did not prove Release PR creation, automerge, publishing, or artifact upload.

## Constraints

- Use a small real user-facing fix rather than manually editing versions.
- Keep the release trigger as normal merged commit metadata.
- Do not bypass PR governance, CI, or Release PR validation.
- Keep npm trusted publishing on OIDC.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/40
- Fix the human `quantex capabilities` output label so it reflects the actual `--yes` flag name.
- Add test coverage for the corrected human output label.

## Done When

- The fix PR lands on `main`.
- release-please creates a patch Release PR.
- Release PR automerge validates and merges the Release PR.
- The final Release workflow publishes the expected stable version to npm and GitHub Releases.

## Verification Notes

- Local validation passed: `bun run memory:check`, `bun run lint`, `bun run typecheck`, `bun run test`.
- Remote validation and final release publication are verified after PR merge.

## Non-Goals

- Changing version calculation rules.
- Testing the beta release path.
- Changing release artifact contents beyond the normal generated version bump.
