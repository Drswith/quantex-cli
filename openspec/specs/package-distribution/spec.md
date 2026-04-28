# package-distribution Specification

## Purpose
TBD - created by archiving change reduce-release-artifact-size. Update Purpose after archive.
## Requirements
### Requirement: Managed-install package MUST exclude standalone release binaries

The npm package consumed by Bun and npm managed installs SHALL exclude standalone release binaries and release-only metadata, even when those files exist locally because release assets were built before publish.

#### Scenario: Release binaries exist before npm publish

- **WHEN** Quantex packs or publishes the managed-install package after `build:bin` has produced files under `dist/bin`
- **THEN** the resulting npm tarball does not contain platform binaries from `dist/bin`
- **AND** it does not contain release-only metadata such as `dist/bin/manifest.json` or `dist/bin/SHA256SUMS.txt`

### Requirement: Managed-install package MUST keep runtime CLI files

The npm package consumed by Bun and npm managed installs SHALL still include the runtime files needed to execute the CLI and postinstall entrypoints.

#### Scenario: User installs Quantex from npm or Bun

- **WHEN** the managed-install package is packed for publication
- **THEN** it still contains the runtime CLI files under `dist/` needed for `qtx` and `quantex`
- **AND** it still contains any install-time entrypoints required by the published package contract
