## REMOVED Requirements

### Requirement: DeepSeek TUI MUST be a supported lifecycle agent

**Reason**: Upstream DeepSeek TUI has renamed to CodeWhale, and Quantex should expose the current upstream lifecycle surface.

**Migration**: Use the CodeWhale catalog entry and `qtx codewhale`.

## ADDED Requirements

### Requirement: CodeWhale MUST be a supported lifecycle agent

Quantex SHALL include CodeWhale in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up CodeWhale

- **WHEN** a user or machine consumer looks up the canonical agent name `codewhale`
- **THEN** Quantex returns a supported agent entry for CodeWhale
- **AND** the entry identifies `codewhale` as the executable binary
- **AND** the entry identifies `codewhale` as its npm package metadata
- **AND** the entry identifies `https://github.com/Hmbown/CodeWhale` as the homepage

#### Scenario: Rejecting old DeepSeek TUI lookup names

- **WHEN** a user or machine consumer looks up `deepseek` or `deepseek-tui`
- **THEN** Quantex does not return a supported agent entry for those names

#### Scenario: Installing CodeWhale through supported methods

- **WHEN** Quantex renders or executes install options for CodeWhale
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux

#### Scenario: Probing CodeWhale version

- **WHEN** Quantex probes the installed version of CodeWhale
- **THEN** it runs `codewhale --version` and parses the output

#### Scenario: Planning CodeWhale updates

- **WHEN** Quantex plans an update for a CodeWhale installation that supports self-update
- **THEN** the catalog exposes `codewhale update` as the agent self-update command

### Requirement: CodeWhale Cargo metadata MUST be supported lifecycle metadata

Quantex SHALL record CodeWhale's Cargo package metadata when defining the supported CodeWhale agent entry.

#### Scenario: Registering CodeWhale Cargo metadata

- **WHEN** Quantex defines the supported CodeWhale agent entry
- **THEN** the entry identifies `codewhale-cli` as Cargo package metadata
- **AND** the Cargo install method includes the upstream-documented `--locked` argument
- **AND** the entry identifies `codewhale` as npm package metadata
