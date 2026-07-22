## ADDED Requirements

### Requirement: README documents the supported TypeScript SDK path

The product README SHALL present the Core SDK as the supported programmatic TypeScript integration, document its runtime prerequisites and current lifecycle methods, and keep CLI onboarding as the primary path for users who want an executable tool.

#### Scenario: TypeScript consumer looks for programmatic integration

- **WHEN** a downstream developer reads the English or Simplified Chinese product README
- **THEN** they can find the Core package installation command and a copyable `createQuantex` import example
- **AND** the example uses only methods implemented in the current stable SDK

#### Scenario: User compares CLI and SDK responsibilities

- **WHEN** a reader reviews SDK documentation
- **THEN** it states that the SDK is non-interactive and returns typed results
- **AND** it directs prompts, human and JSON/NDJSON presentation, exit-code policy, self-upgrade, and command-line execution to `qtx` or `quantex`

### Requirement: README makes compatibility stage and package stability explicit

During the multi-minor transition, the README MUST identify the current Core capability stage, preserved v1 contracts, and any beta or explicit opt-in requirement without implying that a later mutation method is stable before its promotion gates pass.

#### Scenario: Core supports only the read-only first milestone

- **WHEN** the stable Core package exposes only `list` and `inspect`
- **THEN** the README documents those methods as supported
- **AND** it does not advertise install, ensure, update, uninstall, or run as published SDK methods

#### Scenario: Core routing changes in a later minor

- **WHEN** a release promotes a Core mutation family or changes the CLI default route
- **THEN** both language README pages describe the new stage, rollback boundary, and unchanged v1 compatibility promise
