# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Hermes Agent MUST be a supported lifecycle agent

Quantex SHALL include Hermes Agent in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Hermes Agent

- **WHEN** a user or machine consumer looks up the canonical agent name `hermes` or the alias `hermes-agent`
- **THEN** Quantex returns a supported agent entry for Hermes Agent
- **AND** the entry identifies `hermes` as the executable binary
- **AND** the entry identifies `https://github.com/NousResearch/hermes-agent` as the homepage

#### Scenario: Installing Hermes Agent through supported methods

- **WHEN** Quantex renders or executes install options for Hermes Agent
- **THEN** macOS and Linux include the official native shell installer (`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`iex (irm https://hermes-agent.nousresearch.com/install.ps1)`)
- **AND** the entry does not include npm, Cargo, Homebrew, pip, uv, or winget managed install methods for fresh Hermes installs

#### Scenario: Probing Hermes Agent version

- **WHEN** Quantex probes the installed version of Hermes Agent
- **THEN** it runs `hermes --version` and parses the output

#### Scenario: Planning Hermes Agent updates

- **WHEN** Quantex plans an update for a Hermes Agent installation that supports the built-in updater
- **THEN** the catalog exposes `hermes update` as the agent self-update command
