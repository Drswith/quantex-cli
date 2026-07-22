## ADDED Requirements

### Requirement: Core SDK package contains only its consumable runtime contract

The Core SDK npm package SHALL contain its ESM runtime, declarations, package metadata, license, and SDK documentation, and MUST exclude CLI binaries, standalone release binaries, repository source, tests, command modules, and maintainer-only files.

#### Scenario: Core package is packed after all builds

- **WHEN** the repository packs the Core package after CLI and standalone binary builds have run
- **THEN** the tarball contains only the Core distribution allowlist
- **AND** it contains no `bin` entry, `dist/bin`, CLI entry point, source tree, test fixture, or workspace protocol dependency

### Requirement: Core SDK package is verified through clean downstream consumers

Package validation MUST install the actual packed Core tarball into clean temporary consumers and verify Node.js 20 ESM execution, Bun execution, and TypeScript NodeNext compilation without reusing repository-local module links.

#### Scenario: Package verification runs in CI

- **WHEN** CI validates package distribution
- **THEN** a clean consumer installs the packed tarball from its filesystem path
- **AND** runtime and type imports succeed without a repository workspace or `node_modules` symlink

### Requirement: CLI and Core builds remain independently scoped

The repository SHALL build the root CLI and Core package with explicit entries and output directories so cleaning or packing one artifact does not delete or include the other's output.

#### Scenario: Core build runs after CLI build

- **WHEN** the Core build cleans and emits its distribution
- **THEN** the root CLI runtime and standalone binary artifacts remain intact
- **AND** the Core output is confined to its package distribution directory

#### Scenario: CLI build runs after Core build

- **WHEN** the root CLI build cleans and emits its distribution
- **THEN** the Core distribution remains intact
- **AND** the CLI tarball continues to satisfy its existing runtime and binary-exclusion contract

### Requirement: CLI source consumes Core without adding a runtime registry dependency

During the 1.x transition, Quantex CLI source SHALL consume the Core package identity while CLI npm and standalone binary builds MUST inline Core so existing CLI installation and self-upgrade paths do not depend on separately resolving the Core package at runtime.

#### Scenario: CLI package runs without Core installed

- **GIVEN** a clean consumer has installed only the packed `quantex-cli` tarball
- **WHEN** it imports the compatibility root or invokes `qtx` or `quantex`
- **THEN** the supported runtime succeeds without an installed Core package
- **AND** the built output contains no unresolved Core package import

#### Scenario: Standalone binary runs outside the repository

- **WHEN** a standalone binary is executed without repository files or `node_modules`
- **THEN** Core-backed CLI paths remain available from the binary bundle

### Requirement: CLI and Core share one release version without workspace protocols

The root CLI and Core package SHALL carry the same release version, and the root's build-time Core dependency MUST use that exact semver rather than a workspace protocol or an unconstrained compatible range.

#### Scenario: Release PR updates package versions

- **WHEN** release automation proposes a repository version
- **THEN** it updates both package manifests to that exact version
- **AND** it updates the root Core development dependency to the same exact version

#### Scenario: Published manifest is inspected

- **WHEN** either npm tarball is inspected
- **THEN** no dependency contains `workspace:`, repository-relative, or unpublished development protocol syntax
