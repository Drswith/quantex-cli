## ADDED Requirements

### Requirement: Qoder CLI MUST be a supported lifecycle agent
Quantex SHALL include Qoder CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Qoder CLI
- **WHEN** a user or machine consumer looks up the canonical agent name `qoder`
- **THEN** Quantex returns a supported agent entry for Qoder CLI
- **AND** the entry identifies `qodercli` as the executable binary
- **AND** the entry identifies `@qoder-ai/qodercli` as its npm package metadata

#### Scenario: Installing Qoder CLI through supported methods
- **WHEN** Quantex renders or executes install options for Qoder CLI
- **THEN** the catalog includes npm-compatible managed install methods
- **AND** macOS and Linux include the official Homebrew cask and curl installer options
- **AND** Windows includes npm-compatible managed install methods

#### Scenario: Planning Qoder CLI updates
- **WHEN** Quantex plans an update for a Qoder CLI installation that supports self-update
- **THEN** the catalog exposes `qodercli update` as the agent self-update command
