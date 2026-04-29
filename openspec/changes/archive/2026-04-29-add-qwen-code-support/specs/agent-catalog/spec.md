## ADDED Requirements

### Requirement: Qwen Code MUST be a supported lifecycle agent

Quantex SHALL include Qwen Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Qwen Code

- **WHEN** a user or machine consumer looks up the canonical agent name `qwen` or the alias `qwen-code`
- **THEN** Quantex returns a supported agent entry for Qwen Code
- **AND** the entry identifies `qwen` as the executable binary
- **AND** the entry identifies `@qwen-code/qwen-code` as its npm package metadata

#### Scenario: Installing Qwen Code through supported methods

- **WHEN** Quantex renders or executes install options for Qwen Code
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official Homebrew formula and curl installer options
- **AND** Windows includes the official batch installer option
