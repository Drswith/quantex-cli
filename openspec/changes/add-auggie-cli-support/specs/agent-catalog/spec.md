## ADDED Requirements

### Requirement: Auggie CLI MUST be a supported lifecycle agent

Quantex SHALL include Auggie CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Auggie CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `auggie`
- **THEN** Quantex returns a supported agent entry for Auggie CLI
- **AND** the entry identifies `auggie` as the executable binary
- **AND** the entry identifies `@augmentcode/auggie` as its npm package metadata

#### Scenario: Installing Auggie CLI through supported methods

- **WHEN** Quantex renders or executes install options for Auggie CLI
- **THEN** macOS and Linux include npm-compatible and bun-compatible managed install methods
- **AND** Quantex does not advertise a native Windows install method while the upstream docs only claim Windows support through WSL

#### Scenario: Probing Auggie CLI version

- **WHEN** Quantex probes the installed version of Auggie CLI
- **THEN** it runs `auggie --version` and parses the output

#### Scenario: Planning Auggie CLI updates

- **WHEN** Quantex plans an update for an Auggie CLI installation that supports self-update
- **THEN** the catalog exposes `auggie upgrade` as the agent self-update command
