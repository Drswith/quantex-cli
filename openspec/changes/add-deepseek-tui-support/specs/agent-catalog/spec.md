# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: DeepSeek TUI MUST be a supported lifecycle agent

Quantex SHALL include DeepSeek TUI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up DeepSeek TUI

- **WHEN** a user or machine consumer looks up the canonical agent name `deepseek` or the alias `deepseek-tui`
- **THEN** Quantex returns a supported agent entry for DeepSeek TUI
- **AND** the entry identifies `deepseek` as the executable binary
- **AND** the entry identifies `deepseek-tui` as its npm package metadata
- **AND** the entry identifies `https://github.com/Hmbown/DeepSeek-TUI` as the homepage

#### Scenario: Installing DeepSeek TUI through supported methods

- **WHEN** Quantex renders or executes install options for DeepSeek TUI
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux

#### Scenario: Probing DeepSeek TUI version

- **WHEN** Quantex probes the installed version of DeepSeek TUI
- **THEN** it runs `deepseek --version` and parses the output

#### Scenario: Planning DeepSeek TUI updates

- **WHEN** Quantex plans an update for a DeepSeek TUI installation that supports self-update
- **THEN** the catalog exposes `deepseek update` as the agent self-update command
