# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Autohand Code CLI MUST be a supported lifecycle agent

Quantex SHALL include Autohand Code CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Autohand Code CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `autohand` or the alias `autohand-cli`
- **THEN** Quantex returns a supported agent entry for Autohand Code CLI
- **AND** the entry identifies `autohand` as the executable binary
- **AND** the entry identifies `autohand-cli` as its npm package metadata
- **AND** the entry identifies `https://autohand.ai/cli/` as the homepage

#### Scenario: Installing Autohand Code CLI through supported methods

- **WHEN** Quantex renders or executes install options for Autohand Code CLI
- **THEN** macOS and Linux include the official shell installer option (`curl -fsSL https://autohand.ai/install.sh | bash`)
- **AND** Windows includes the official PowerShell installer option (`iwr -useb https://autohand.ai/install.ps1 | iex`)

#### Scenario: Probing Autohand Code CLI version

- **WHEN** Quantex probes the installed version of Autohand Code CLI
- **THEN** it runs `autohand --version` and parses the output

#### Scenario: Planning Autohand Code CLI updates

- **WHEN** Quantex plans an update for an Autohand Code CLI installation
- **THEN** the catalog does not expose a self-update command because upstream documentation currently points users to installer scripts and release assets rather than a dedicated `autohand update` subcommand
