# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: CodeBuddy Code MUST be a supported lifecycle agent

Quantex SHALL include CodeBuddy Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up CodeBuddy Code

- **WHEN** a user or machine consumer looks up the canonical agent name `codebuddy` or the alias `codebuddy-code`
- **THEN** Quantex returns a supported agent entry for CodeBuddy Code
- **AND** the entry identifies `codebuddy` as the executable binary
- **AND** the entry identifies `@tencent-ai/codebuddy-code` as its npm package metadata
- **AND** the entry identifies `https://www.codebuddy.cn/docs/cli/installation` as the homepage

#### Scenario: Installing CodeBuddy Code through supported methods

- **WHEN** Quantex renders or executes install options for CodeBuddy Code
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official Homebrew tap formula and curl installer options
- **AND** Windows includes the official PowerShell installer option

#### Scenario: Probing CodeBuddy Code version

- **WHEN** Quantex probes the installed version of CodeBuddy Code
- **THEN** it runs `codebuddy --version` and parses the output

#### Scenario: Planning CodeBuddy Code updates

- **WHEN** Quantex plans an update for a CodeBuddy Code installation that supports self-update
- **THEN** the catalog exposes `codebuddy update` as the agent self-update command
