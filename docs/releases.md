# Releases

The repository keeps a source-controlled [CHANGELOG.md](../CHANGELOG.md). A CLI Release PR updates that changelog together with `.release-please-manifest.json`, `package.json`, and `src/generated/build-meta.ts`.

## Primary CLI release closure

`quantex-cli`, the GitHub Release, and standalone binaries form the primary public release closure. Release automation:

1. prepares a release-please PR from successful release-worthy protected-branch history;
2. requires the generated Release PR to be re-authored as one maintainer commit before merge;
3. seals the exact successful protected-branch head as an immutable `v<version>` tag and explicitly dispatches publication at that tag;
4. builds and validates one release-candidate artifact containing the npm tarball, standalone binaries, manifest, checksums, and release notes;
5. creates or recovers a draft GitHub Release and verifies its candidate assets;
6. publishes or verifies the exact candidate tarball on npm;
7. makes the GitHub Release public only after npm integrity closure.

Registry errors other than a conclusive exact-version not-found response stop publication. Reruns are tag-idempotent: an existing tag may never move, a draft or published GitHub Release is reconciled in place, and an already published npm version is accepted only when its registry integrity matches the candidate tarball.

Recovery uses one source role: the immutable tag identifies the release commit, and one Actions artifact carries every byte consumed by the mutation job. Publication never checks out source, rebuilds, or selects a candidate from newer branch history. If a run fails after tag creation, redispatch `Release` at the same tag; never move the tag.

This repository does not coordinate publication of the separate `quantex` alias package.

## Core SDK publication

`quantex-core` is the public TypeScript SDK package. It begins supported publication at `0.1.0`; the manually published `0.0.0` bootstrap version is never selected for a release. Core has an independent version line and immutable `core-v<version>` tags.

The manually dispatched [`release-core.yml`](../.github/workflows/release-core.yml) workflow validates, publishes, and verifies only the Core package through npm OIDC. It creates no CLI GitHub Release or standalone binaries, and Core publication state never reopens CLI release closure. Conversely, the CLI Release workflow pack-validates bundled Core but neither queries nor publishes it.

If an npm publication attempt is interrupted, re-dispatch Release Core from `main`: it resolves the same `core-v<version>` source and skips publication only after npm confirms the exact package version.

## v1.2.0 recovery closure

The `v1.2.0` GitHub Release was initially created before npm publication completed. Recovery closed on 2026-07-27 through [Release run 30233396646](https://github.com/Drswith/quantex-cli/actions/runs/30233396646): it used the immutable v1.2.0 release commit for the package and artifacts, published and verified `quantex-cli@1.2.0`, and attached the manifest, checksums, and five standalone binaries without publishing Core.
