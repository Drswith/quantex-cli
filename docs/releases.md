# Releases

The repository keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A CLI Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, and `src/generated/build-meta.ts`.

## Primary CLI release closure

`quantex-cli`, the GitHub Release, and standalone binaries form the primary public release closure. Release automation:

1. resolves the selected protected branch's pending release commit and exact `quantex-cli` npm state when a maintainer dispatches Release;
2. builds and validates the repository, including the bundled Core workspace and its clean packed-tarball consumers;
3. publishes or verifies the exact `quantex-cli` version;
4. creates or refreshes the GitHub Release only after CLI npm closure;
5. uploads and verifies standalone release artifacts.

Registry errors other than a conclusive exact-version not-found response stop publication. Reruns are idempotent: an already published CLI version is verified and skipped, while an existing GitHub Release with a missing CLI version is recovered before artifacts are attached.

Recovery uses one source role: the immutable release commit remains the source for package builds, product tests, npm publication, and standalone artifacts. Rerunning the same manual dispatch recovers a partial closure without checking out a protected-branch control source or running a fixed historical compatibility harness.

This repository does not coordinate publication of the separate `quantex` alias package.

## Core SDK publication

`quantex-core` is the public TypeScript SDK package. It begins supported publication at `0.1.0`; the manually published `0.0.0` bootstrap version is never selected for a release. Core has an independent version line and immutable `core-v<version>` tags.

The manually dispatched [`release-core.yml`](../.github/workflows/release-core.yml) workflow validates, publishes, and verifies only the Core package through npm OIDC. It creates no CLI GitHub Release or standalone binaries, and Core publication state never reopens CLI release closure. Conversely, the CLI Release workflow pack-validates bundled Core but neither queries nor publishes it.

If an npm publication attempt is interrupted, re-dispatch Release Core from `main`: it resolves the same `core-v<version>` source and skips publication only after npm confirms the exact package version.

## v1.2.0 recovery closure

The `v1.2.0` GitHub Release was initially created before npm publication completed. Recovery closed on 2026-07-27 through [Release run 30233396646](https://github.com/Drswith/quantex-cli/actions/runs/30233396646): it used the immutable v1.2.0 release commit for the package and artifacts, published and verified `quantex-cli@1.2.0`, and attached the manifest, checksums, and five standalone binaries without publishing Core.
