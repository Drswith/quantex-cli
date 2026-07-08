## ADDED Requirements

### Requirement: Command Code MUST be a supported lifecycle agent

Quantex SHALL include Command Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Command Code

- **WHEN** a user or machine consumer looks up the canonical agent name `commandcode` or the aliases `command-code`, `cmd`, or `cmdc`
- **THEN** Quantex returns a supported agent entry for Command Code
- **AND** the entry identifies `command-code` as the executable binary
- **AND** the entry identifies `command-code` as its npm package metadata
- **AND** the entry identifies `https://commandcode.ai/docs/quickstart` as the homepage

#### Scenario: Installing Command Code through supported methods

- **WHEN** Quantex renders or executes install options for Command Code
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux
- **AND** the npm install command installs `command-code`

#### Scenario: Probing Command Code version

- **WHEN** Quantex probes the installed version of Command Code
- **THEN** it runs `command-code --version` and parses the output

#### Scenario: Planning Command Code updates

- **WHEN** Quantex plans an update for a Command Code installation that supports self-update
- **THEN** the catalog exposes `command-code update` as the agent self-update command
