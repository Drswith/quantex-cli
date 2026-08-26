# Releases

The repository keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, and `src/generated/build-meta.ts`.

## Primary CLI release closure

`quantex-cli`, the GitHub Release, and standalone binaries form the primary public release closure. Release automation:

1. runs release-please automatically on push to `main` and, when no readiness gate is active, opens or updates its Release PR;
2. merges the Release PR after review, re-authoring, and required CI;
3. creates an immutable `v<version>` tag through the `tag-release` job once push CI succeeds on the release commit (release-please runs with `skip-github-release: true` and never tags);
4. runs `release.yml` on the tag push to validate the release identity, build and stage the exact release candidate once, then publish npm and GitHub Release assets from that candidate.

The full build-candidate chain is exercisable locally without a tag via `bun run release:dry-run`.

`main` is the only release line and publishes to the `latest` npm dist-tag. There is no prerelease channel: the beta branch was retired, and no mechanism replaced it. Publication still routes a version carrying a prerelease suffix to the `beta` dist-tag, but that is a fail-safe so such a build can never displace `latest`, not a supported way to ship previews.

A Release PR that proposes a new major version on the stable line is rejected by governance unless a maintainer adds `Release-As: <version>` to the Release PR body before merge. A separate deferred-major readiness gate remains authoritative even after that declaration.

## Temporary stable v2 gate

Stable `2.x` is not release-ready. The required v2 refactor must merge and then complete at least 90 days of stabilization before a future reviewed OpenSpec change can lift the gate.

The gate denies stable `2.x` at the three boundaries that name a version: generated Release PR validation, deterministic tag planning, and release-candidate build or publication identity validation. Adding `Release-As: 2.x.y` is not a readiness override.

Release Please prepares Release PRs normally. It briefly did not: `main` carried a v1 surface removal that made every computed version a stable `2.0.0`, and the workflow passed `skip-github-pull-request: true` to stop that ineligible PR being recreated, which also blocked every eligible 1.x release. Restoring the removed surface returned `main` to the minor line, so the suppression was removed. Denial belongs to the layers that name a version; a readiness gate must not be implemented by pausing preparation.

If `main` ever computes a stable `2.x` again, the generated Release PR is rejected by validation rather than prevented from existing. Do not hand-edit source version files, create a replacement tag, or bypass only one layer of the v2 gate.

Registry errors other than a conclusive exact-version not-found response stop publication. Reruns are tag-idempotent.

This repository does not coordinate publication of the separate `quantex` alias package.

## Core SDK publication

`quantex-core` is published independently through manually dispatched [`release-core.yml`](../.github/workflows/release-core.yml) with npm OIDC. Core publication does not gate CLI release closure, but a CLI release that pins a new `quantex-core` version must be preceded by that Core publication.

## v1.2.0 recovery closure

The `v1.2.0` GitHub Release recovery closed on 2026-07-27 through [Release run 30233396646](https://github.com/Drswith/quantex-cli/actions/runs/30233396646).
