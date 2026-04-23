---
id: qtx-0029
title: Fix semantic-release trusted publishing on main
status: in_progress
priority: high
area: release
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

# Task: Fix semantic-release trusted publishing on main

## Goal

- merged `main` pushes trigger a release workflow that can publish through npm trusted publishing without `NPM_TOKEN`
- the release workflow and npm trusted publisher reference the same workflow file
- Quantex release docs explain the OIDC assumptions clearly

## Context

- the current release flow reaches `semantic-release`, but npm publish fails before release because the installed npm plugin falls back to token auth
- `workflow_run` also makes the trusted publisher relationship harder to reason about, since npm needs to trust the workflow file that actually triggers publishing

## Constraints

- keep normal PR-only `main` governance intact
- avoid reintroducing local release commands or a rolling changelog
- keep GitHub Releases as the canonical changelog

## Implementation Notes

- relevant files:
  - `.github/workflows/release.yml`
  - `package.json`
  - `docs/runbooks/releasing-quantex.md`
  - `docs/github-collaboration.md`
- relevant commands:
  - `bun install`
  - `bun run memory:check`
  - `bun run lint`
  - `bun run typecheck`
- investigate installed `@semantic-release/npm` version before changing the workflow

## Done When

- `@semantic-release/npm` is upgraded to a version that supports npm trusted publishing on GitHub Actions
- release automation is triggered from `.github/workflows/release.yml` on merged `main` pushes
- docs explain the trusted publishing contract and no longer describe the old `workflow_run` dependency

## Non-Goals

- changing Quantex runtime CLI behavior
- reintroducing manual release commands
