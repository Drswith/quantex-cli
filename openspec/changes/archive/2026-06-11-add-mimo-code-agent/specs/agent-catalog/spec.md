# agent-catalog Spec Delta

## ADDED Requirements

### Requirement: MiMoCode MUST be a supported lifecycle agent

Quantex SHALL include MiMoCode in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up MiMoCode

- **WHEN** a user or machine consumer looks up the canonical agent name `mimo` or the aliases `mimocode` or `mimo-code`
- **THEN** Quantex returns a supported agent entry for MiMoCode
- **AND** the entry identifies `mimo` as the executable binary
- **AND** the entry identifies `@mimo-ai/cli` as its npm package metadata
- **AND** the entry identifies `https://github.com/XiaomiMiMo/MiMo-Code` as the homepage

#### Scenario: Installing MiMoCode through supported methods

- **WHEN** Quantex renders or executes install options for MiMoCode
- **THEN** Windows, macOS, and Linux include the npm-compatible managed install method
- **AND** macOS and Linux include the official shell installer option (`curl -fsSL https://mimo.xiaomi.com/install | bash`)
- **AND** Windows does not include a script install method because upstream does not document a native PowerShell installer

#### Scenario: Probing MiMoCode version

- **WHEN** Quantex probes the installed version of MiMoCode
- **THEN** it runs `mimo --version` and parses the output

#### Scenario: Planning MiMoCode updates

- **WHEN** Quantex plans an update for a MiMoCode installation
- **THEN** the catalog does not expose a dedicated self-update command because upstream documentation does not describe one
