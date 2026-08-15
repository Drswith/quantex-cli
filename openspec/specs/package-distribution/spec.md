# package-distribution Specification

## Purpose

Define the current observable contract for what the managed-install npm package may ship when standalone release binaries also exist in the working tree.
## Requirements
### Requirement: Managed-install package MUST exclude standalone release binaries

The npm package consumed by Bun and npm managed installs SHALL exclude standalone release binaries and release-only metadata, even when those files exist locally because release assets were built before publish.

#### Scenario: Release binaries exist before npm publish

- **WHEN** Quantex packs or publishes the managed-install package after `build:bin` has produced files under `dist/bin`
- **THEN** the resulting npm tarball does not contain platform binaries from `dist/bin`
- **AND** it does not contain release-only metadata such as `dist/bin/manifest.json` or `dist/bin/SHA256SUMS.txt`

### Requirement: Managed-install package MUST keep runtime CLI files

The npm package consumed by Bun and npm managed installs SHALL still include the runtime files needed to execute the CLI and perform lazy self-install-source reconciliation at runtime.

#### Scenario: User installs Quantex from npm or Bun

- **WHEN** the managed-install package is packed for publication
- **THEN** it still contains the runtime CLI files under `dist/` needed for `qtx` and `quantex`
- **AND** it does not require an install-time `postinstall` entrypoint to preserve the managed self-upgrade contract

### Requirement: Core uses its final public package identity and version line

The Core SDK SHALL be named `quantex-core` and SHALL be publicly publishable. Its version SHALL be independent from the root CLI version, while the root development dependency MUST pin the exact Core workspace version without introducing a published runtime dependency or a workspace protocol.

#### Scenario: public Core package is packed
- **WHEN** the Core package is built and packed
- **THEN** its manifest identifies `quantex-core` and its exact Core version
- **AND** it exposes only its documented root and package metadata subpaths

#### Scenario: root CLI is packaged
- **WHEN** the root CLI package is packed
- **THEN** it contains no runtime dependency on `quantex-core`
- **AND** it remains runnable without Core installed from npm
