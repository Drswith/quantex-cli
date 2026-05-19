# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Devin for Terminal MUST be a supported lifecycle agent

Quantex SHALL include Devin for Terminal in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Devin for Terminal

- **WHEN** a user or machine consumer looks up the canonical agent name `devin`
- **THEN** Quantex returns a supported agent entry for Devin for Terminal
- **AND** the entry identifies `devin` as the executable binary
- **AND** the entry identifies `https://cli.devin.ai/` as the homepage

#### Scenario: Installing Devin for Terminal through supported methods

- **WHEN** Quantex renders or executes install options for Devin for Terminal
- **THEN** the catalog includes the official macOS/Linux shell installer (`curl -fsSL https://cli.devin.ai/install.sh | bash`)
- **AND** the catalog includes the official Windows PowerShell installer (`irm https://static.devin.ai/cli/setup.ps1 | iex`)
- **AND** the catalog does not invent unsupported managed package metadata when upstream documentation does not publish it

#### Scenario: Probing Devin for Terminal version

- **WHEN** Quantex probes the installed version of Devin for Terminal
- **THEN** it runs `devin version` and parses the output

#### Scenario: Planning Devin for Terminal updates

- **WHEN** Quantex plans an update for a Devin for Terminal installation that supports the built-in updater
- **THEN** the catalog exposes `devin update` as the agent self-update command
