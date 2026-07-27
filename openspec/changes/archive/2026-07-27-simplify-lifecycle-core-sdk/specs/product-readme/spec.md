## ADDED Requirements

### Requirement: README documents the supported TypeScript SDK path

The product README SHALL present the Core SDK as the intended programmatic TypeScript integration, document its runtime prerequisites, current lifecycle methods, and distribution stage, and keep CLI onboarding as the primary published path for users who want an executable tool.

#### Scenario: TypeScript consumer looks for programmatic integration

- **WHEN** a downstream developer reads the English or Simplified Chinese product README
- **THEN** they can find a copyable `createQuantex` import example and an accurate statement of whether public package installation is activated
- **AND** the example uses only methods implemented in the current stable SDK

#### Scenario: Core registry publication is deferred

- **WHEN** the Core workspace is private and its final registry identity is not activated
- **THEN** the README MUST NOT present the provisional npm install command as currently usable
- **AND** it MUST state that CLI releases do not depend on Core registry publication

#### Scenario: User compares CLI and SDK responsibilities

- **WHEN** a reader reviews SDK documentation
- **THEN** it states that the SDK is non-interactive and returns typed results
- **AND** it directs prompts, human and JSON/NDJSON presentation, exit-code policy, self-upgrade, and command-line execution to `qtx` or `quantex`

### Requirement: README makes compatibility stage and package stability explicit

During the multi-minor transition, the README MUST identify the current Core capability stage, preserved v1 contracts, and any beta or explicit opt-in requirement without implying that a later mutation method is stable before its promotion gates pass.

#### Scenario: Core supports the bounded initial SDK surface

- **WHEN** the stable Core package exposes `list`, `inspect`, `install`, and `ensure`
- **THEN** the README documents those methods as supported
- **AND** it does not advertise update, uninstall, or run as published SDK methods

#### Scenario: Core routing changes in a later minor

- **WHEN** a release promotes a Core mutation family or changes the CLI default route
- **THEN** both language README pages describe the new stage, rollback boundary, and unchanged v1 compatibility promise
