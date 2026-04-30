# Add Goose agent support

## Summary

Add Goose (by Block) as a supported lifecycle agent in the Quantex catalog with install, inspect, version probe, and self-update metadata.

## Motivation

Goose is an open-source, extensible AI agent by Block that runs on the developer's machine. It supports CLI and desktop modes with a growing user base (4,900+ Homebrew installs in 30 days). Users expect `quantex install goose`, `quantex info goose`, and `quantex update goose` to work.

## Spec delta

Add a new requirement to `openspec/specs/agent-catalog/spec.md`:

### Requirement: Goose MUST be a supported lifecycle agent

Quantex SHALL include Goose in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Goose

- **WHEN** a user or machine consumer looks up the canonical agent name `goose`
- **THEN** Quantex returns a supported agent entry for Goose
- **AND** the entry identifies `goose` as the executable binary
- **AND** the entry identifies `https://github.com/block/goose` as the homepage

#### Scenario: Installing Goose through supported methods

- **WHEN** Quantex renders or executes install options for Goose
- **THEN** macOS and Linux include the official curl install script option and the Homebrew formula install method (`block-goose-cli`)
- **AND** Windows includes the official curl install script option (Git Bash / MSYS2) and the PowerShell install script option

#### Scenario: Probing Goose version

- **WHEN** Quantex probes the installed version of Goose
- **THEN** it runs `goose --version` and parses the output

#### Scenario: Planning Goose updates

- **WHEN** Quantex plans an update for a Goose installation that supports self-update
- **THEN** the catalog exposes `goose update` as the agent self-update command

## Implementation notes

- Create `src/agents/definitions/goose.ts` with the agent definition
- Register the export in `src/agents/index.ts`
- Follow the same pattern as existing agents (crush, kimi)
