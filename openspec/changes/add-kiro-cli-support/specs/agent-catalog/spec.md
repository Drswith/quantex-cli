# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Kiro CLI MUST be a supported lifecycle agent

Quantex SHALL include Kiro CLI (by Amazon) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Kiro CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `kiro` or the alias `kiro-cli`
- **THEN** Quantex returns a supported agent entry for Kiro CLI
- **AND** the entry identifies `kiro-cli` as the executable binary

#### Scenario: Installing Kiro CLI through supported methods

- **WHEN** Quantex renders or executes install options for Kiro CLI
- **THEN** macOS and Linux include the official curl install script option (`curl -fsSL https://cli.kiro.dev/install | bash`)
- **AND** Windows includes the official PowerShell install script option (`irm 'https://cli.kiro.dev/install.ps1' | iex`)

#### Scenario: Probing Kiro CLI version

- **WHEN** Quantex probes the installed version of Kiro CLI
- **THEN** it runs `kiro-cli --version` and parses the output

#### Scenario: Planning Kiro CLI updates

- **WHEN** Quantex plans an update for a Kiro CLI installation
- **THEN** the catalog does not expose a self-update command because Kiro CLI auto-updates in the background
