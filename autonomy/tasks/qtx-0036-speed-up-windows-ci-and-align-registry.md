---
id: qtx-0036
title: Speed up Windows CI and align registry usage
status: done
priority: high
area: workflow
depends_on:
  - qtx-0034
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/releasing-quantex.md
---

# Task: Speed up Windows CI and align registry usage

## Goal

Reduce repeated Windows CI cost without dropping mainline coverage, and make repository dependency resolution use the official npm registry consistently.

## Context

Recent CI runs showed that `windows-latest` spent most of its time in runner startup and `bun install`, not in build or test execution. The repository lockfile also pointed tarball URLs at `registry.npmmirror.com`, which is a poor default for GitHub-hosted runners in the United States and can amplify cold-install variance.

## Constraints

- Keep cross-platform coverage for release confidence.
- Do not remove Windows full-test coverage from protected branches entirely.
- Keep workflow-only changes non-release-worthy.
- Prefer repository-controlled registry defaults over per-machine assumptions.

## Implementation Notes

- Add Bun dependency caching to `.github/workflows/ci.yml`.
- Remove redundant `actions/setup-node` usage from the CI workflow.
- Skip Windows full test execution on `pull_request`, but keep Windows install and build smoke coverage there.
- Keep Windows full tests on `push`, `workflow_dispatch`, and scheduled CI runs.
- Add `.npmrc` with the official npm registry.
- Rewrite `bun.lock` tarball URLs from `registry.npmmirror.com` to `registry.npmjs.org`.

## Done When

- PR CI no longer pays the full Windows test cost on every run.
- Push and scheduled CI still exercise Windows full tests.
- The repository default registry and lockfile both point at the official npm registry.
- Release/process docs mention the CI split so future workflow changes do not accidentally revert it.

## Verification Notes

- Local validation passed: `bun run lint`, `bun run typecheck`.
- CI workflow updated in `.github/workflows/ci.yml`.
- Registry defaults updated in `.npmrc` and `bun.lock`.

## Non-Goals

- Reworking release workflow behavior outside CI scope.
- Introducing self-hosted runners.
- Changing product runtime behavior.
