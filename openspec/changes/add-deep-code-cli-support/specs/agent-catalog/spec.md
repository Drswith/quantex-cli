# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: Deep Code CLI MUST be a supported lifecycle agent

Quantex SHALL include Deep Code CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Deep Code CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `deepcode`
- **THEN** Quantex returns a supported agent entry for Deep Code CLI
- **AND** the entry identifies `deepcode` as the executable binary
- **AND** the entry identifies `@vegamo/deepcode-cli` as npm package metadata
- **AND** the entry identifies `https://github.com/lessweb/deepcode-cli` as the homepage

#### Scenario: Installing Deep Code CLI through supported methods

- **WHEN** Quantex renders or executes install options for Deep Code CLI
- **THEN** Windows, macOS, and Linux include the npm managed install option for `@vegamo/deepcode-cli`

#### Scenario: Probing Deep Code CLI version

- **WHEN** Quantex probes the installed version of Deep Code CLI
- **THEN** it runs `deepcode --version` and parses the output

#### Scenario: Planning Deep Code CLI updates

- **WHEN** Quantex plans an update for a Deep Code CLI installation
- **THEN** the catalog does not expose a dedicated self-update command because upstream documentation publishes managed npm installation flow instead of a stable dedicated update subcommand
