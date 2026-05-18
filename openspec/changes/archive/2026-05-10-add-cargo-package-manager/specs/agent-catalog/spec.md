## ADDED Requirements

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

#### Scenario: Registering DeepSeek TUI Cargo metadata

- **WHEN** Quantex defines the supported DeepSeek TUI agent entry
- **THEN** the entry identifies `deepseek-tui-cli` as Cargo package metadata
- **AND** the Cargo install method includes the upstream-documented `--locked` argument
- **AND** the entry continues to identify `deepseek-tui` as npm package metadata
