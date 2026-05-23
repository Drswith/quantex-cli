## ADDED Requirements

### Requirement: mise install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare mise-managed install methods and mise package metadata when an upstream agent can be installed through mise.

#### Scenario: Registering mise package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed through mise
- **THEN** the entry can identify the mise tool reference through `packages.mise`
- **AND** the entry can include mise managed install methods on platforms where that mise tool reference is supported
- **AND** mise package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering mise install guidance

- **WHEN** Quantex renders install methods for an agent with a mise managed install method
- **THEN** the install method is labeled as a managed mise install
- **AND** the command guidance uses `mise use --global <tool-ref>`

#### Scenario: Registering Codex CLI mise metadata

- **WHEN** Quantex defines the Codex CLI agent entry
- **THEN** the entry identifies `npm:@openai/codex` as mise package metadata
- **AND** Windows, macOS, and Linux include a mise managed install method
- **AND** the entry continues to identify `@openai/codex` as npm package metadata
