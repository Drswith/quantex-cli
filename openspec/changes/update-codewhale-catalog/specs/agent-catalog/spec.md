# agent-catalog Spec Delta

## REMOVED Requirements

### Requirement: DeepSeek TUI MUST be a supported lifecycle agent

**Reason**: Upstream DeepSeek TUI rebranded to CodeWhale and this change intentionally removes legacy `deepseek` / `deepseek-tui` compatibility.

**Migration**: Use the supported CodeWhale catalog entry and `qtx codewhale`.

## ADDED Requirements

### Requirement: CodeWhale MUST be a supported lifecycle agent

Quantex SHALL include CodeWhale in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up CodeWhale

- **WHEN** a user or machine consumer looks up the canonical agent name `codewhale`
- **THEN** Quantex returns a supported agent entry for CodeWhale
- **AND** the entry identifies `codewhale` as the executable binary
- **AND** the entry identifies `codewhale` as its npm package metadata
- **AND** the entry identifies `https://github.com/Hmbown/CodeWhale` as the homepage

#### Scenario: Installing CodeWhale through supported methods

- **WHEN** Quantex renders or executes install options for CodeWhale
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux

#### Scenario: Probing CodeWhale version

- **WHEN** Quantex probes the installed version of CodeWhale
- **THEN** it runs `codewhale --version` and parses the output

#### Scenario: Planning CodeWhale updates

- **WHEN** Quantex plans an update for a CodeWhale installation that supports self-update
- **THEN** the catalog exposes `codewhale update` as the agent self-update command

## MODIFIED Requirements

### Requirement: Cargo install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare Cargo-managed install methods and crate package metadata when an upstream agent is distributed as a Rust crate.

#### Scenario: Registering Cargo package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed as a Rust crate
- **THEN** the entry can identify the crate through `packages.cargo`
- **AND** the entry can include Cargo managed install methods on platforms where the crate is supported
- **AND** Cargo package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering Cargo install guidance

- **WHEN** Quantex renders install methods for an agent with a Cargo managed install method
- **THEN** the install method is labeled as a managed Cargo install
- **AND** the command guidance uses `cargo install <crate>`

#### Scenario: Registering CodeWhale Cargo metadata

- **WHEN** Quantex defines the supported CodeWhale agent entry
- **THEN** the entry identifies `codewhale-cli` as Cargo package metadata
- **AND** the Cargo install method includes the upstream-documented `--locked` argument
- **AND** the entry identifies `codewhale` as npm package metadata
