# Releases

The repository keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, and `src/generated/build-meta.ts`.

## Primary CLI release closure

`quantex-cli`, the GitHub Release, and standalone binaries form the primary public release closure. Release automation:

1. opens or updates a release-please Release PR automatically on push to `main` or `beta`;
2. merges the Release PR after review, re-authoring, and required CI;
3. creates an immutable `v<version>` tag after push CI succeeds (release-please or the tag backstop when a manual merge left the Release PR untagged);
4. runs `release.yml` on tag push to build, validate, publish npm, and publish GitHub Release assets.

Registry errors other than a conclusive exact-version not-found response stop publication. Reruns are tag-idempotent.

This repository does not coordinate publication of the separate `quantex` alias package.

## Core SDK publication

`quantex-core` is published independently through manually dispatched [`release-core.yml`](../.github/workflows/release-core.yml) with npm OIDC. Core publication does not gate CLI release closure.

## v1.2.0 recovery closure

The `v1.2.0` GitHub Release recovery closed on 2026-07-27 through [Release run 30233396646](https://github.com/Drswith/quantex-cli/actions/runs/30233396646).
