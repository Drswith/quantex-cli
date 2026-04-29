# agent-catalog Specification

## Purpose
TBD - created by archiving change remove-agent-description-metadata. Update Purpose after archive.
## Requirements
### Requirement: Supported agent catalog entries MUST stay lifecycle-focused

Quantex SHALL keep supported agent catalog metadata scoped to values that directly support installation, inspection, resolution, execution, update planning, and stable machine-readable contracts.

#### Scenario: Registering a supported agent entry

- **WHEN** Quantex defines or updates a supported agent entry
- **THEN** the entry includes only metadata that is relevant to lifecycle operations or stable identification
- **AND** that metadata may include canonical name, display name, lookup aliases, homepage, package metadata, install methods, binary name, version probe data, and self-update commands
- **AND** Quantex does not require free-form descriptive marketing copy as part of the catalog contract

### Requirement: Lifecycle inspection surfaces MUST avoid localized descriptive metadata

Quantex lifecycle inspection surfaces SHALL expose stable agent identifiers and lifecycle metadata without requiring localized prose fields.

#### Scenario: Rendering or returning agent metadata

- **GIVEN** the user runs `quantex info <agent>` or `quantex inspect <agent>`
- **WHEN** Quantex returns human-readable or structured agent metadata
- **THEN** the result includes the identifiers and lifecycle fields needed to install, inspect, or update the agent
- **AND** the result does not depend on a free-form `description` field to remain valid

### Requirement: Qoder CLI MUST be a supported lifecycle agent

Quantex SHALL include Qoder CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Qoder CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `qoder` or the alias `qodercli`
- **THEN** Quantex returns a supported agent entry for Qoder CLI
- **AND** the entry identifies `qodercli` as the executable binary
- **AND** the entry identifies `@qoder-ai/qodercli` as its npm package metadata

#### Scenario: Installing Qoder CLI through supported methods

- **WHEN** Quantex renders or executes install options for Qoder CLI
- **THEN** the catalog includes npm-compatible managed install methods
- **AND** macOS and Linux include the official Homebrew cask and curl installer options
- **AND** Windows includes npm-compatible managed install methods

#### Scenario: Planning Qoder CLI updates

- **WHEN** Quantex plans an update for a Qoder CLI installation that supports self-update
- **THEN** the catalog exposes `qodercli update` as the agent self-update command

### Requirement: Qwen Code MUST be a supported lifecycle agent

Quantex SHALL include Qwen Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Qwen Code

- **WHEN** a user or machine consumer looks up the canonical agent name `qwen`
- **THEN** Quantex returns a supported agent entry for Qwen Code
- **AND** the entry identifies `qwen` as the executable binary
- **AND** the entry identifies `@qwen-code/qwen-code` as its npm package metadata

#### Scenario: Installing Qwen Code through supported methods

- **WHEN** Quantex renders or executes install options for Qwen Code
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official Homebrew formula and curl installer options
- **AND** Windows includes the official batch installer option

### Requirement: Kimi Code CLI MUST be a supported lifecycle agent

Quantex SHALL include Kimi Code CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Kimi Code CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `kimi` or the aliases `kimi-code` or `kimi-cli`
- **THEN** Quantex returns a supported agent entry for Kimi Code CLI
- **AND** the entry identifies `kimi` as the executable binary

#### Scenario: Installing Kimi Code CLI through supported methods

- **WHEN** Quantex renders or executes install options for Kimi Code CLI
- **THEN** macOS and Linux include the official curl install script option
- **AND** Windows includes the official PowerShell install script option

#### Scenario: Planning Kimi Code CLI updates

- **WHEN** Quantex plans an update for a Kimi Code CLI installation that supports self-update
- **THEN** the catalog exposes `uv tool upgrade kimi-cli --no-cache` as the agent self-update command

### Requirement: Kilo CLI MUST use the current supported display name

Quantex SHALL expose the Kilo catalog entry with the display name `Kilo CLI` while keeping the canonical agent slug `kilo`.

#### Scenario: Rendering Kilo metadata

- **WHEN** a user or machine consumer inspects the supported `kilo` agent entry
- **THEN** Quantex reports the display name `Kilo CLI`
- **AND** the entry continues to identify `kilo` as the canonical agent name and executable binary
