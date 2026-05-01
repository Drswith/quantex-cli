## ADDED Requirements

### Requirement: Managed CLI runtime MUST execute on supported Node.js without Bun

The published Quantex managed-install JS runtime SHALL execute on supported Node.js without requiring Bun to be present on `PATH` at runtime.

#### Scenario: Running an npm-installed Quantex CLI without Bun

- **WHEN** a user installs Quantex through a managed JS package path such as npm
- **AND** the environment provides supported Node.js but no `bun` executable
- **THEN** running `qtx --version` or `quantex --version` starts the published CLI successfully
- **AND** the runtime does not depend on Bun globals or a `bun` shebang

#### Scenario: Running a no-install package-manager entrypoint without Bun

- **WHEN** a package manager launches the published Quantex bin entrypoint in a supported Node.js environment without `bun` on `PATH`
- **THEN** read-only commands such as `qtx commands --json` can execute successfully

