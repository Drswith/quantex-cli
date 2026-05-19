## ADDED Requirements

### Requirement: pip install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare pip-managed install methods and pip package metadata when an upstream agent is distributed as a Python package.

#### Scenario: Registering pip package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed as a Python package
- **THEN** the entry can identify the package through `packages.pip`
- **AND** the entry can include pip managed install methods on platforms where the package is supported
- **AND** pip package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering pip install guidance

- **WHEN** Quantex renders install methods for an agent with a pip managed install method
- **THEN** the install method is labeled as a managed pip install
- **AND** the command guidance uses `pip install <package>`

#### Scenario: Registering Mistral Vibe pip metadata

- **WHEN** Quantex defines the supported Mistral Vibe agent entry
- **THEN** the entry identifies `mistral-vibe` as pip package metadata
- **AND** the pip install method is included as a managed install method on Windows, macOS, and Linux
- **AND** the entry continues to support other install methods such as script installers
