# Releases

The repository keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, `packages/core/package.json`, the root's exact `@quantex/core` development dependency, and `src/generated/build-meta.ts`.

## Primary CLI release closure

`quantex-cli`, the GitHub Release, and standalone binaries form the primary public release closure. Release automation:

1. resolves the latest successful release commit and exact `quantex-cli` npm state;
2. builds and validates the repository, including the private Core workspace and its clean packed-tarball consumers;
3. publishes or verifies the exact `quantex-cli` version;
4. creates or refreshes the GitHub Release only after CLI npm closure;
5. uploads and verifies standalone release artifacts.

Registry errors other than a conclusive exact-version not-found response stop publication. Reruns are idempotent: an already published CLI version is verified and skipped, while an existing GitHub Release with a missing CLI version is recovered before artifacts are attached.

This repository does not coordinate publication of the separate `quantex` alias package.

## Deferred Core publication

`@quantex/core` remains a provisional private package identity. The main Release workflow builds and pack-validates it but does not query, publish, or require it for CLI release closure. This prevents unavailable scope permissions from blocking `quantex-cli` 1.2–1.5 releases while retaining a real SDK package boundary and clean downstream consumer tests.

Public Core publication requires a separate OpenSpec activation change. That change must confirm:

- the final package name and registry;
- maintainer publication permission;
- the first-package bootstrap and 2FA owner;
- trusted-publisher configuration;
- public versioning and tag policy;
- independent partial-publication recovery.

Do not remove the Core manifest's private guard or add a variable-controlled publish step before that activation change is approved and validated.

## v1.2.0 recovery

The current `v1.2.0` GitHub Release was created before npm publication completed. After this split-release workflow lands, rerun the Release workflow for `main`. It will use the immutable v1.2.0 release commit, publish or verify `quantex-cli@1.2.0`, and upload the already defined standalone artifacts without attempting to publish `@quantex/core`.
