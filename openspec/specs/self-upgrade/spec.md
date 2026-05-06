# Self-Upgrade Specification

## Purpose

Define the current observable behavior and safety contract for upgrading Quantex CLI itself.
## Requirements
### Requirement: Self-upgrade MUST inspect Quantex install source

The self-upgrade system SHALL identify how Quantex CLI is installed before selecting an upgrade path.

#### Scenario: Inspecting self install source

- GIVEN the user runs `quantex upgrade` or `quantex doctor`
- WHEN Quantex inspects its own runtime state
- THEN it classifies the install source as one of `bun`, `npm`, `binary`, `source`, or `unknown`
- AND that classification drives upgrade behavior and recovery messaging

### Requirement: Self-upgrade MUST reconcile persisted install source state

The self-upgrade system SHALL persist self install-source knowledge and reconcile it against runtime detection.

#### Scenario: Using persisted state when runtime detection is inconclusive

- GIVEN Quantex has a stored `state.self.installSource`
- AND the current runtime inspection cannot classify the install source beyond `unknown`
- WHEN Quantex inspects self-upgrade state
- THEN it uses the persisted install source for upgrade planning

#### Scenario: Refreshing stale state when runtime detection changes

- GIVEN Quantex has a stored `state.self.installSource`
- AND runtime inspection resolves a different non-`unknown` install source
- WHEN Quantex inspects self-upgrade state
- THEN it updates the stored install source to the runtime-detected value

#### Scenario: Persisting a managed install source lazily on first inspection

- GIVEN Quantex was installed through a global `bun` or `npm` managed install
- AND `state.self.installSource` is not yet present
- WHEN the user runs a self-inspection surface such as `quantex upgrade`, `quantex upgrade --check`, `quantex doctor`, or `quantex capabilities`
- THEN Quantex detects the managed install source from runtime package metadata or executable layout
- AND it writes that detected source into `state.self.installSource`
- AND later self-upgrade planning uses the stored managed install source without requiring an install-time package script

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

### Requirement: Managed self-upgrade MUST keep registry checks and installs consistent

Managed self-upgrade SHALL use the same resolved registry for package-manager version checks and managed-install execution, SHALL install the selected package tag directly instead of relying on package-manager update semantics, and SHALL not treat a lower reported latest version as an update target.

#### Scenario: Managed self-upgrade suppresses stale downgrade targets

- GIVEN Quantex was installed via `bun` or `npm`
- AND the current CLI version is newer than the resolved `latestVersion` from cache or registry
- WHEN the user runs `quantex upgrade` or `quantex upgrade --check`
- THEN Quantex does not invoke managed self-upgrade toward that lower version
- AND it does not present the lower version as an available update

### Requirement: Managed self-upgrade MUST verify the installed version after update

Managed self-upgrade SHALL verify that the installed Quantex CLI entrypoint reports the expected version after Bun or npm reports a successful install.

#### Scenario: Managed self-upgrade verifies the installed CLI version

- GIVEN Quantex was installed via `bun` or `npm`
- AND a managed self-upgrade attempt reports success from the package manager
- WHEN Quantex re-runs the installed Quantex CLI entrypoint with `--version`
- THEN the reported version matches the upgrade target

#### Scenario: Managed self-upgrade does not confuse the host runtime with Quantex

- GIVEN the published Quantex CLI runs through a host runtime such as `node`
- AND `process.execPath` therefore points to that host runtime binary
- WHEN Quantex verifies a managed self-upgrade result
- THEN it probes the installed Quantex package entrypoint instead of the host runtime binary
- AND a host runtime version like `22.22.2` does not become the observed Quantex version

#### Scenario: Managed self-upgrade reports registry lag when verification fails

- GIVEN Quantex was installed via `bun` or `npm`
- AND the package manager reported success
- BUT the installed Quantex CLI entrypoint still reports the previous version
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

### Requirement: Binary self-upgrade MUST support platform-safe replacement

The binary self-upgrade path SHALL use a replacement strategy that matches platform constraints.

#### Scenario: Replacing the running binary on macOS or Linux

- GIVEN the current platform is macOS or Linux
- WHEN a binary upgrade is executed
- THEN Quantex performs in-place replacement of the installed executable

#### Scenario: Replacing the running binary on Windows

- GIVEN the current platform is Windows
- WHEN a binary upgrade is executed
- THEN Quantex uses delayed replacement semantics compatible with Windows file locking behavior

### Requirement: Release artifacts MUST be smoke-validated before publish

The release pipeline SHALL verify that at least the current runner's publishable binary artifact is executable and matches the generated release metadata.

#### Scenario: Verifying the current runner release asset

- GIVEN Quantex has built release binaries, `SHA256SUMS.txt`, and `manifest.json`
- WHEN the release verification workflow runs
- THEN it checks that the current runner asset exists in the manifest and checksum file
- AND it executes that binary with `--version`
- AND the command reports the expected build version

### Requirement: Self-upgrade MUST expose recovery guidance

The self-upgrade system SHALL provide recovery hints when automatic upgrade is unavailable or fails, and SHALL only advertise self-updates when the resolved latest version is newer than the installed CLI version.

#### Scenario: Doctor suppresses stale self-update warnings

- GIVEN Quantex resolves a self `latestVersion` that is lower than the installed CLI version
- WHEN the user runs `quantex doctor`
- THEN the doctor output does not emit `SELF_UPDATE_AVAILABLE`
- AND it does not label the installed CLI as outdated

#### Scenario: Passive update notices suppress stale self-update warnings

- GIVEN Quantex resolves a self `latestVersion` that is lower than the installed CLI version
- WHEN a successful human-mode command evaluates the passive self-update notice
- THEN Quantex does not display an available-update notice for that lower version

### Requirement: Self-upgrade MAY support explicit channel and check flows

The self-upgrade surface SHALL support explicit user-controlled update checks and channel selection.

#### Scenario: User performs an explicit check

- GIVEN the user runs `quantex upgrade --check`
- WHEN Quantex evaluates whether a newer version exists
- THEN it checks for availability without performing the upgrade

#### Scenario: User selects a non-default channel

- GIVEN the user runs `quantex upgrade --channel beta`
- WHEN Quantex checks for or performs self-upgrade
- THEN it uses the selected channel instead of the default channel

