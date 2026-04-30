# Agent Catalog — ForgeCode delta

## ADDED Requirements

### Requirement: ForgeCode MUST be a supported lifecycle agent

Quantex SHALL include ForgeCode (by Antinomy) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up ForgeCode

- **WHEN** a user or machine consumer looks up the canonical agent name `forgecode` or the alias `forge`
- **THEN** Quantex returns a supported agent entry for ForgeCode
- **AND** the entry identifies `forge` as the executable binary
- **AND** the entry identifies `forgecode` as its npm package metadata
- **AND** the entry identifies `https://forgecode.dev` as the homepage

#### Scenario: Installing ForgeCode through supported methods

- **WHEN** Quantex renders or executes install options for ForgeCode
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official curl install script option
- **AND** Windows includes the official PowerShell install script option

#### Scenario: Probing ForgeCode version

- **WHEN** Quantex probes the installed version of ForgeCode
- **THEN** it runs `forge --version` and parses the output

#### Scenario: Planning ForgeCode updates

- **WHEN** Quantex plans an update for a ForgeCode installation that supports self-update
- **THEN** the catalog exposes `forge update` as the agent self-update command
