## ADDED Requirements

### Requirement: CLI doctor SHALL diagnose through in-repo Core without a public SDK doctor method

For the 1.12 CLI doctor slice, Quantex SHALL synthesize environment diagnosis and
recovery guidance for CLI `doctor` through an in-repo Core diagnosis engine.
That entry point MUST preserve the maintained v1 human/JSON contracts, exit-code
meanings, empty alias set, installer key set, and issue machine identifiers, and
MUST NOT wrap a published `createQuantex()` `doctor()` / `diagnose()` method into
a second CLI-shaped API. This CLI ownership MUST NOT, by itself, expand the
published `quantex-core` method surface, change package/binary identity, bump
state schema version 2, or alter frozen command names, aliases, `--json` /
`--output` fields, or exit-code meanings.

#### Scenario: Default doctor invocation

- **WHEN** a user invokes `quantex doctor`
- **THEN** Quantex gathers installer/self/agent observations through the CLI
  bridge and synthesizes issues through the in-repo Core diagnosis engine
- **AND THEN** the published SDK does not gain a `doctor` or `diagnose` method
  solely because of this CLI routing change

#### Scenario: Machine-readable doctor output

- **WHEN** `doctor` runs with JSON output
- **THEN** the maintained v1 field names, types, meanings, installer keys, and
  issue machine identifiers remain unchanged
- **AND THEN** Core ownership of the diagnosis path remains absent from the
  maintained output payloads

#### Scenario: Doctor success exit policy stays frozen

- **WHEN** `doctor` completes observation and diagnosis successfully
- **THEN** Quantex exits with code 0
- **AND THEN** any `blocking` issue remains a structured data field rather than
  a new non-zero exit meaning for this slice

#### Scenario: Published SDK surface stays frozen for the doctor slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI doctor slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK `doctor` or `diagnose` method appears solely because
  CLI `doctor` diagnoses through in-repo Core

## MODIFIED Requirements

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall`, MUST launch CLI `exec` / shortcut through in-repo
Core execution without publishing SDK `run` / `exec` methods, and MUST diagnose
CLI `doctor` through in-repo Core without publishing SDK `doctor` / `diagnose`
methods. Quantex MUST NOT expand the published `quantex-core` public method
surface as part of this CLI promotion, and MUST NOT remove a v1 compatibility
surface before the staged soak and a separately approved later-major deprecation
change.

#### Scenario: User invokes doctor during the 1.12 transition

- **WHEN** a user invokes `doctor` during the 1.x transition after this slice
- **THEN** Quantex diagnoses through the in-repo Core diagnosis engine behind
  the frozen CLI contract
- **AND THEN** the published SDK does not gain a `doctor` or `diagnose` method

#### Scenario: User invokes exec or shortcut during the 1.12 transition

- **WHEN** a user invokes `exec` or shortcut `qtx <agent>` during the 1.x
  transition after this slice
- **THEN** Quantex launches through the in-repo Core execution engine behind
  the frozen CLI contract
- **AND THEN** the published SDK does not gain a `run` or `exec` method

#### Scenario: Published SDK surface stays frozen for this slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root export
  after the 1.12 CLI Core slices
- **THEN** `createQuantex()` still exposes only the previously published lifecycle
  methods
- **AND THEN** no new `update`, `uninstall`, `run`, `exec`, `doctor`, or
  `diagnose` SDK method appears solely because the CLI now routes those
  operations through in-repo Core modules

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change
