## ADDED Requirements

### Requirement: Amp MUST be a supported lifecycle agent

Quantex SHALL include Amp (by Sourcegraph) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Amp

- **WHEN** a user or machine consumer looks up the canonical agent name `amp`
- **THEN** Quantex returns a supported agent entry for Amp
- **AND** the entry identifies `amp` as the executable binary
- **AND** the entry identifies `@sourcegraph/amp` as its npm package metadata
- **AND** the entry identifies `https://ampcode.com/` as the homepage

#### Scenario: Installing Amp through supported methods

- **WHEN** Quantex renders or executes install options for Amp
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms

#### Scenario: Probing Amp version

- **WHEN** Quantex probes the installed version of Amp
- **THEN** it runs `amp version` and parses the output

#### Scenario: Planning Amp updates

- **WHEN** Quantex plans an update for an Amp installation that supports self-update
- **THEN** the catalog exposes `amp update` as the agent self-update command
