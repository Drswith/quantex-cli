## ADDED Requirements

### Requirement: Desktop bundles MUST consume architecture-matched release sidecars

Desktop build artifacts SHALL package the matching Quantex macOS CLI sidecar
for each supported architecture while npm package contents remain unchanged.

#### Scenario: Building a macOS desktop bundle

- **WHEN** the desktop build is prepared for arm64 or x64 macOS
- **THEN** it builds and packages the matching Quantex release binary as a
  desktop sidecar resource
- **AND** npm package verification continues to exclude `dist/bin` artifacts

### Requirement: The private Desktop workspace MUST coexist with the private Core workspace

The root workspace manifest SHALL include `apps/desktop` for local desktop
development while retaining the existing Core distribution checks and without
including Desktop artifacts in the published npm package.

#### Scenario: Verifying the Core package in the Desktop repository

- **WHEN** Core package distribution verification runs from the root workspace
- **THEN** it accepts exactly `apps/desktop` and `packages/core` as private
  repository workspaces
- **AND** it continues to validate the packed Core tarball independently
