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

### Requirement: Self-upgrade MUST route by install source

The self-upgrade system SHALL choose an upgrade strategy based on the detected install source.

#### Scenario: Upgrading a managed install

- GIVEN Quantex was installed via `bun` or `npm`
- WHEN the user runs `quantex upgrade`
- THEN Quantex uses the matching package-manager upgrade strategy

#### Scenario: Upgrading a binary install

- GIVEN Quantex was installed from a standalone binary
- WHEN the user runs `quantex upgrade`
- THEN Quantex uses the binary self-replacement path for the current platform

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

The self-upgrade system SHALL provide recovery hints when automatic upgrade is unavailable or fails.

#### Scenario: Doctor shows self recovery guidance

- GIVEN the user runs `quantex doctor`
- WHEN Quantex finishes inspecting self-upgrade state
- THEN the output includes recovery guidance appropriate to the detected install source

#### Scenario: Doctor reports install-source drift and auto-update limits

- GIVEN Quantex detects that its persisted install source no longer matches available package-manager tooling
- OR the current install source does not support self auto-update
- WHEN the user runs `quantex doctor`
- THEN the output includes an actionable warning that explains the mismatch
- AND points the user toward reinstalling or restoring a supported install source

#### Scenario: Doctor JSON exposes machine-actionable self remediation

- GIVEN the user runs `quantex doctor --json`
- AND Quantex emits a self-related issue
- WHEN the command returns structured data
- THEN each self-related issue includes a stable issue code
- AND includes `blocking`, `category`, `suggestedAction`, and `suggestedCommands`
- AND includes a docs reference that points to the relevant recovery guide

#### Scenario: Upgrade failure surfaces a recovery path

- GIVEN a self-upgrade attempt fails
- WHEN Quantex reports the failure
- THEN the output includes a recovery action that matches the detected install source

#### Scenario: Human upgrade output highlights the next action

- GIVEN the user runs `quantex upgrade`
- AND the command cannot upgrade automatically or the upgrade fails
- WHEN Quantex renders human-mode output
- THEN it explains the failure reason
- AND presents the next recovery action in a way that is easy to scan

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
