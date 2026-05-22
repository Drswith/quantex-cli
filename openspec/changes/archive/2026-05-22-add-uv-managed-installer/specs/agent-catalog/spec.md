## ADDED Requirements

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

#### Scenario: Registering Kimi CLI uv metadata

- **WHEN** Quantex defines the supported Kimi Code CLI agent entry
- **THEN** the entry identifies `kimi-cli` as uv package metadata
- **AND** macOS and Linux include the uv managed install method with the upstream-documented `--python 3.13` argument
- **AND** Windows does not include a uv managed install method while upstream docs do not list native Windows support
