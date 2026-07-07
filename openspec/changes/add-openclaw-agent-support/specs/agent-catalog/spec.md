# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: OpenClaw MUST be a supported lifecycle agent

Quantex SHALL include OpenClaw in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up OpenClaw

- **WHEN** a user or machine consumer looks up the canonical agent name `openclaw`
- **THEN** Quantex returns a supported agent entry for OpenClaw
- **AND** the entry identifies `openclaw` as the executable binary
- **AND** the entry identifies `openclaw` as its npm package metadata
- **AND** the entry identifies `https://github.com/openclaw/openclaw` as the homepage

#### Scenario: Installing OpenClaw through supported methods

- **WHEN** Quantex renders or executes install options for OpenClaw
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official native shell installer (`curl -fsSL https://openclaw.ai/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`iwr -useb https://openclaw.ai/install.ps1 | iex`)

#### Scenario: Probing OpenClaw version

- **WHEN** Quantex probes the installed version of OpenClaw
- **THEN** it runs `openclaw --version` and parses the output

#### Scenario: Planning OpenClaw updates

- **WHEN** Quantex plans an update for an OpenClaw installation that supports the built-in updater
- **THEN** the catalog exposes `openclaw update` as the agent self-update command
