## ADDED Requirements

### Requirement: Grok Build MUST be a supported lifecycle agent

Quantex SHALL include Grok Build in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Grok Build

- **WHEN** a user or machine consumer looks up the canonical agent name `grok` or the alias `grok-build`
- **THEN** Quantex returns a supported agent entry for Grok Build
- **AND** the entry identifies `grok` as the executable binary
- **AND** the entry identifies `https://docs.x.ai/build/overview` as the homepage
- **AND** the entry does not claim the `agent` lookup alias already used by Cursor CLI

#### Scenario: Installing Grok Build through supported methods

- **WHEN** Quantex renders or executes install options for Grok Build
- **THEN** macOS and Linux include the official current curl install script option (`curl -fsSL https://x.ai/cli/install.sh | bash`)
- **AND** Windows includes the official current PowerShell install script option (`irm https://x.ai/cli/install.ps1 | iex`)
- **AND** the entry does not invent npm, bun, or Homebrew managed install methods that upstream docs do not document

#### Scenario: Probing Grok Build version

- **WHEN** Quantex probes the installed version of Grok Build
- **THEN** it runs `grok --version` and parses the output

#### Scenario: Planning Grok Build updates

- **WHEN** Quantex plans an update for a Grok Build installation that supports self-update
- **THEN** the catalog exposes `grok update` as the agent self-update command
