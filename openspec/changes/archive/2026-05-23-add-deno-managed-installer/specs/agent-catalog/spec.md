## ADDED Requirements

### Requirement: Deno global install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare Deno global managed install methods and Deno package metadata when an upstream agent is distributed through `deno install --global`.

#### Scenario: Registering Deno package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed through `deno install --global`
- **THEN** the entry can identify the package or URL specifier through `packages.deno`
- **AND** the entry can include Deno managed install methods on platforms where the package is supported
- **AND** Deno package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering Deno install guidance

- **WHEN** Quantex renders install methods for an agent with a Deno managed install method
- **THEN** the install method is labeled as a managed Deno install
- **AND** the command guidance uses `deno install --global <package-or-url>`
- **AND** package-specific Deno install arguments are preserved in the rendered command before the package or URL specifier

#### Scenario: Registering Deno executable names

- **WHEN** Quantex installs an agent through a Deno managed install method
- **THEN** the installed-agent state records the agent executable name
- **AND** Quantex can use that executable name for Deno global uninstall instead of guessing it from the package or URL specifier
