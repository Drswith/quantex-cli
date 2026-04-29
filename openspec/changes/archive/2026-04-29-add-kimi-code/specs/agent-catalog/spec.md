## ADDED Requirements

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
