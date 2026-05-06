# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: jcode MUST be a supported lifecycle agent

Quantex SHALL include `jcode` in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up `jcode`

- **WHEN** a user or machine consumer looks up the canonical agent name `jcode`
- **THEN** Quantex returns a supported agent entry for `jcode`
- **AND** the entry identifies `jcode` as the executable binary
- **AND** the entry identifies `https://github.com/1jehuang/jcode` as the homepage

#### Scenario: Installing `jcode` through supported methods

- **WHEN** Quantex renders or executes install options for `jcode`
- **THEN** macOS includes the official Homebrew tap formula option (`brew install 1jehuang/jcode/jcode`)
- **AND** macOS and Linux include the official shell installer option (`curl -fsSL https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh | bash`)
- **AND** Windows includes the official PowerShell installer option (`irm https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.ps1 | iex`)

#### Scenario: Probing `jcode` version

- **WHEN** Quantex probes the installed version of `jcode`
- **THEN** it runs `jcode --version` and parses the output

#### Scenario: Planning `jcode` updates

- **WHEN** Quantex plans an update for a `jcode` installation
- **THEN** the catalog does not expose a self-update command because upstream installation docs publish platform-specific installer flows rather than a stable dedicated update subcommand
