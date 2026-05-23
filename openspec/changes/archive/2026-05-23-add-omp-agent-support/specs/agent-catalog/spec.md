# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: oh-my-pi (omp) MUST be a supported lifecycle agent

Quantex SHALL include `oh-my-pi (omp)` in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up oh-my-pi (omp)

- **WHEN** a user or machine consumer looks up the canonical agent name `omp`
- **THEN** Quantex returns a supported agent entry for oh-my-pi
- **AND** the entry identifies `omp` as the executable binary
- **AND** the entry identifies `@oh-my-pi/pi-coding-agent` as the package metadata source for managed install diagnostics

#### Scenario: Installing oh-my-pi (omp) through supported methods

- **WHEN** Quantex renders or executes install options for `omp`
- **THEN** the catalog includes the Bun-managed install method on Windows, macOS, and Linux
- **AND** macOS and Linux include the official shell installer (`curl -fsSL https://omp.sh/install | sh`)
- **AND** Windows includes the official PowerShell installer (`irm https://omp.sh/install.ps1 | iex`)

#### Scenario: Probing oh-my-pi (omp) version and update diagnostics

- **WHEN** Quantex probes or plans updates for an installed `omp` agent
- **THEN** it uses `omp --version` as the version probe command
- **AND** it does not expose an `omp` self-update command unless upstream documentation publishes a stable dedicated update subcommand
