# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Reasonix MUST be a supported lifecycle agent

Quantex SHALL include Reasonix in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Reasonix

- **WHEN** a user or machine consumer looks up the canonical agent name `reasonix` or the alias `deepseek-reasonix`
- **THEN** Quantex returns a supported agent entry for Reasonix
- **AND** the entry identifies `reasonix` as the executable binary
- **AND** the entry identifies `reasonix` as its npm package metadata
- **AND** the entry identifies `https://github.com/esengine/DeepSeek-Reasonix` as the homepage

#### Scenario: Installing Reasonix through supported methods

- **WHEN** Quantex renders or executes install options for Reasonix
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux

#### Scenario: Probing Reasonix version

- **WHEN** Quantex probes the installed version of Reasonix
- **THEN** it runs `reasonix --version` and parses the output

#### Scenario: Planning Reasonix updates

- **WHEN** Quantex plans an update for a Reasonix installation that supports self-update
- **THEN** the catalog exposes `reasonix update` as the agent self-update command
