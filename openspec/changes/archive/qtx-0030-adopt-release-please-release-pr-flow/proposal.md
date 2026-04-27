# qtx-0030: Adopt release-please Release PR flow

> Migrated from `autonomy/tasks/qtx-0030-adopt-release-please-release-pr-flow.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | release |
| Depends on | - |
| Human review | `required` |
| Docs to update | docs/runbooks/releasing-quantex.md, docs/github-collaboration.md, docs/releases.md |

## Historical Task Contract

# Task: Adopt release-please Release PR flow

## Goal

- replace merge-to-main direct semantic-release publishing with release-please Release PRs
- make release versions visible in source-controlled files before publication
- keep npm publishing on GitHub Actions trusted publishing with OIDC

## Context

- semantic-release successfully published through OIDC, but left `package.json` and generated build metadata stale in the source tree
- stale source versions made release provenance harder to reason about from a checked-out tag
- release-please offers a better fit for source-visible version bumps because it creates a reviewable Release PR that updates version files and changelog before publication

## Constraints

- keep normal product changes behind PR-only `main`
- do not reintroduce local release commands
- keep npm publishing tokenless through GitHub Actions OIDC
- release artifacts must still be smoke checked before npm publish and GitHub Release asset upload

## Implementation Notes

- configure release-please through `release-please-config.json` and `.release-please-manifest.json`
- let Release PRs update:
  - `CHANGELOG.md`
  - `package.json`
  - `.release-please-manifest.json`
  - `src/generated/build-meta.ts`
- publish only when `release-please-action` reports `release_created`
- keep root `CHANGELOG.md` explicitly allowed by `memory:check`

## Done When

- normal `main` merges create or update a Release PR instead of immediately publishing
- merging a Release PR validates, builds, publishes npm, and uploads GitHub Release artifacts
- source-visible version files align with the release tag
- release docs describe the new workflow

## Non-Goals

- adding alpha or beta release branches
- changing Quantex runtime CLI behavior
- replacing GitHub Actions trusted publishing with `NPM_TOKEN`
