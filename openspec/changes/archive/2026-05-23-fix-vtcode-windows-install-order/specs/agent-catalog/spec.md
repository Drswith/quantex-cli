## MODIFIED Requirements

### Requirement: VTCode MUST be a supported lifecycle agent

Quantex SHALL include VTCode in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up VTCode

- **WHEN** a user or machine consumer looks up the canonical agent name `vtcode`
- **THEN** Quantex returns a supported agent entry for VTCode
- **AND** the entry identifies `vtcode` as the executable binary
- **AND** the entry identifies `vtcode` as its Cargo crate metadata
- **AND** the entry identifies `https://github.com/vinhnx/vtcode` as the homepage

#### Scenario: Installing VTCode through supported methods

- **WHEN** Quantex renders or executes install options for VTCode
- **THEN** the catalog includes the Cargo managed install method on Windows, macOS, and Linux
- **AND** Windows orders the Cargo managed install method before the official native PowerShell installer while upstream Windows release assets are absent
- **AND** macOS and Linux include the official native shell installer (`curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`irm https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1 | iex`)
- **AND** macOS and Linux include the Homebrew formula install method (`vtcode`)

#### Scenario: Probing VTCode version

- **WHEN** Quantex probes the installed version of VTCode
- **THEN** it runs `vtcode --version` and parses the output

#### Scenario: Planning VTCode updates

- **WHEN** Quantex plans an update for a VTCode installation that supports the built-in updater
- **THEN** the catalog exposes `vtcode update` as the agent self-update command
