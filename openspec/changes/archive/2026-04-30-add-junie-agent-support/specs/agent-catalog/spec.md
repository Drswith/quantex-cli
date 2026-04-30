# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Junie CLI MUST be a supported lifecycle agent

Quantex SHALL include Junie CLI (by JetBrains) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Junie CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `junie`
- **THEN** Quantex returns a supported agent entry for Junie CLI
- **AND** the entry identifies `junie` as the executable binary
- **AND** the entry identifies `@jetbrains/junie` as its npm package metadata
- **AND** the entry identifies `https://junie.jetbrains.com/docs/junie-cli.html` as the homepage

#### Scenario: Installing Junie CLI through supported methods

- **WHEN** Quantex renders or executes install options for Junie CLI
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official curl install script option and the Homebrew tap formula install method (`jetbrains-junie/junie/junie`)
- **AND** Windows includes the official PowerShell install script option (`iex (irm 'https://junie.jetbrains.com/install.ps1')`)

#### Scenario: Probing Junie CLI version

- **WHEN** Quantex probes the installed version of Junie CLI
- **THEN** it runs `junie --version` and parses the output

#### Scenario: Planning Junie CLI updates

- **WHEN** Quantex plans an update for a Junie CLI installation
- **THEN** the catalog does not expose a self-update command because upstream documentation describes automated update checks rather than a dedicated update subcommand
