## ADDED Requirements

### Requirement: Antigravity CLI MUST be a supported lifecycle agent
Quantex SHALL include Google Antigravity CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Antigravity CLI
- **WHEN** a user or machine consumer looks up the canonical agent name `antigravity` or the aliases `agy` or `antigravity-cli`
- **THEN** Quantex returns a supported agent entry for Antigravity CLI
- **AND** the entry identifies `agy` as the executable binary
- **AND** the entry identifies `https://antigravity.google/product/antigravity-cli` as the homepage

#### Scenario: Installing Antigravity CLI through supported methods
- **WHEN** Quantex renders or executes install options for Antigravity CLI
- **THEN** macOS and Linux include the official shell installer option (`curl -fsSL https://antigravity.google/cli/install.sh | bash`)
- **AND** Windows includes the official PowerShell installer option (`irm https://antigravity.google/cli/install.ps1 | iex`)

#### Scenario: Probing Antigravity CLI version
- **WHEN** Quantex probes the installed version of Antigravity CLI
- **THEN** it runs `agy --version` and parses the output

#### Scenario: Planning Antigravity CLI updates
- **WHEN** Quantex plans an update for an Antigravity CLI installation that supports self-update
- **THEN** the catalog exposes `agy update` as the agent self-update command
