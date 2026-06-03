## MODIFIED Requirements

### Requirement: Kimi Code CLI MUST be a supported lifecycle agent

Quantex SHALL include Kimi Code CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Kimi Code CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `kimi` or the aliases `kimi-code` or `kimi-cli`
- **THEN** Quantex returns a supported agent entry for Kimi Code CLI
- **AND** the entry identifies `kimi` as the executable binary
- **AND** the entry identifies `@moonshot-ai/kimi-code` as its npm package metadata

#### Scenario: Installing Kimi Code CLI through supported methods

- **WHEN** Quantex renders or executes install options for Kimi Code CLI
- **THEN** macOS and Linux include the official current curl install script option (`curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash`)
- **AND** Windows includes the official current PowerShell install script option (`irm https://code.kimi.com/kimi-code/install.ps1 | iex`)
- **AND** Windows, macOS, and Linux include the npm-compatible managed install method
- **AND** the entry does not include uv managed install methods for fresh Kimi Code CLI installs

#### Scenario: Probing Kimi Code CLI version

- **WHEN** Quantex probes the installed version of Kimi Code CLI
- **THEN** it runs `kimi --version` and parses the output

#### Scenario: Planning Kimi Code CLI updates

- **WHEN** Quantex plans an update for a Kimi Code CLI installation that supports self-update
- **THEN** the catalog exposes `kimi upgrade` as the agent self-update command

### Requirement: uv tool install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare uv tool managed install methods and uv package metadata when an upstream agent is distributed through `uv tool install`.

#### Scenario: Registering uv package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed through `uv tool install`
- **THEN** the entry can identify the tool package through `packages.uv`
- **AND** the entry can include uv managed install methods on platforms where the package is supported
- **AND** uv package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering uv install guidance

- **WHEN** Quantex renders install methods for an agent with a uv managed install method
- **THEN** the install method is labeled as a managed uv install
- **AND** the command guidance uses `uv tool install <package>`
- **AND** package-specific uv install arguments are preserved in the rendered command

#### Scenario: Registering OpenHands uv metadata

- **WHEN** Quantex defines the supported OpenHands CLI agent entry
- **THEN** the entry identifies `openhands` as uv package metadata
- **AND** macOS and Linux include the uv managed install method with the upstream-documented `--python 3.12` argument
- **AND** the entry continues to include the official install script option
- **AND** the entry does not advertise a native Windows install method because upstream CLI docs route Windows users through WSL

#### Scenario: Registering Mistral Vibe uv metadata

- **WHEN** Quantex defines the supported Mistral Vibe agent entry
- **THEN** the entry identifies `mistral-vibe` as uv package metadata
- **AND** macOS, Linux, and Windows include a uv managed install method
- **AND** the entry continues to identify `mistral-vibe` as pip package metadata
- **AND** macOS and Linux continue to include the official shell installer option
