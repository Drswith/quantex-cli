## ADDED Requirements

### Requirement: Tabnine CLI MUST be a supported lifecycle agent

Quantex SHALL include Tabnine CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Tabnine CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `tabnine` or the alias `tabnine-cli`
- **THEN** Quantex returns a supported agent entry for Tabnine CLI
- **AND** the entry identifies `tabnine` as the executable binary
- **AND** the entry identifies `https://www.tabnine.com/platform-cli/` as the homepage

#### Scenario: Installing Tabnine CLI through supported methods

- **WHEN** Quantex renders or executes install options for Tabnine CLI
- **THEN** macOS and Linux include the official curl installer script option
- **AND** Windows includes the official PowerShell installer script option

#### Scenario: Probing Tabnine CLI version

- **WHEN** Quantex probes the installed version of Tabnine CLI
- **THEN** it runs `tabnine --version` and parses the output

#### Scenario: Planning Tabnine CLI updates

- **WHEN** Quantex plans an update for a Tabnine CLI installation
- **THEN** the catalog exposes re-running the installer script as the update method
