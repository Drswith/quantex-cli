## ADDED Requirements

### Requirement: Mistral Vibe MUST be a supported lifecycle agent

Quantex SHALL include Mistral Vibe in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Mistral Vibe

- **WHEN** a user or machine consumer looks up the canonical agent name `vibe` or the alias `mistral-vibe`
- **THEN** Quantex returns a supported agent entry for Mistral Vibe
- **AND** the entry identifies `vibe` as the executable binary
- **AND** the entry identifies `https://docs.mistral.ai/mistral-vibe/terminal/install` as the homepage

#### Scenario: Installing Mistral Vibe through supported methods

- **WHEN** Quantex renders or executes install options for Mistral Vibe
- **THEN** macOS and Linux include the official shell installer option (`curl -LsSf https://mistral.ai/vibe/install.sh | bash`)
- **AND** macOS, Linux, and Windows include direct `uv` and `pip` install command options for `mistral-vibe`

#### Scenario: Probing Mistral Vibe version

- **WHEN** Quantex probes the installed version of Mistral Vibe
- **THEN** it runs `vibe --version` and parses the output

#### Scenario: Planning Mistral Vibe updates

- **WHEN** Quantex plans an update for a Mistral Vibe installation
- **THEN** the catalog does not expose a self-update command because upstream documentation currently describes automatic update behavior rather than a dedicated manual update subcommand
