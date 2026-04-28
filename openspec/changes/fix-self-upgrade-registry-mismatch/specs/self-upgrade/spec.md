## MODIFIED Requirements

### Requirement: Self-upgrade MUST route by install source

The self-upgrade system SHALL choose an upgrade strategy based on the detected install source, and managed self-upgrades SHALL resolve the package registry they use before checking for or performing an upgrade.

#### Scenario: Upgrading a managed install

- GIVEN Quantex was installed via `bun` or `npm`
- WHEN the user runs `quantex upgrade`
- THEN Quantex uses the matching package-manager upgrade strategy
- AND it resolves a managed self-upgrade registry before checking package availability or performing installation

#### Scenario: Upgrading a binary install

- GIVEN Quantex was installed from a standalone binary
- WHEN the user runs `quantex upgrade`
- THEN Quantex uses the binary self-replacement path for the current platform

## ADDED Requirements

### Requirement: Managed self-upgrade MUST keep registry checks and installs consistent

Managed self-upgrade SHALL use the same resolved registry for package-manager version checks and managed-install execution.

#### Scenario: Managed self-upgrade follows the selected registry

- GIVEN Quantex was installed via `bun` or `npm`
- AND a registry is resolved for managed self-upgrade
- WHEN the user runs `quantex upgrade --check` or `quantex upgrade`
- THEN Quantex checks the installable latest version through that same registry
- AND any managed self-upgrade command uses that same registry for installation

#### Scenario: Self-upgrade uses a Quantex-specific registry override

- GIVEN Quantex was installed via `bun` or `npm`
- AND the user set `QTX_SELF_UPDATE_REGISTRY` or `selfUpdateRegistry`
- WHEN Quantex checks for or performs self-upgrade
- THEN the override registry takes precedence over the package manager's default registry

### Requirement: Managed self-upgrade MUST verify the installed version after update

Managed self-upgrade SHALL verify that the running Quantex executable reports the expected version after Bun or npm reports a successful install.

#### Scenario: Managed self-upgrade verifies the installed CLI version

- GIVEN Quantex was installed via `bun` or `npm`
- AND a managed self-upgrade attempt reports success from the package manager
- WHEN Quantex re-runs the current executable with `--version`
- THEN the reported version matches the upgrade target

#### Scenario: Managed self-upgrade reports registry lag when verification fails

- GIVEN Quantex was installed via `bun` or `npm`
- AND the package manager reported success
- BUT the running executable still reports the previous version
- WHEN Quantex finishes the upgrade attempt
- THEN the command fails instead of reporting success
- AND the output includes recovery guidance for reinstalling or retrying against a different registry

### Requirement: Managed self-upgrade MUST surface registry lag clearly

Managed self-upgrade SHALL treat the selected registry as the authoritative source for installability and SHALL warn when the official npm registry is newer than the selected registry.

#### Scenario: Current registry is behind official npm

- GIVEN Quantex was installed via `bun` or `npm`
- AND the selected managed self-upgrade registry resolves an installable latest version
- AND the official npm registry resolves a newer version
- WHEN the user runs `quantex upgrade --check` or `quantex upgrade`
- THEN Quantex bases availability and upgrade targeting on the selected registry's installable latest version
- AND the output warns that upstream npm is newer than the selected registry
