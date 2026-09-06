## ADDED Requirements

### Requirement: CLI upgrade SHALL execute through in-repo Core without a public SDK upgrade method

For this 1.x CLI upgrade knife, Quantex SHALL plan, check, and apply CLI
`upgrade` through an in-repo Core self-upgrade engine. That entry point MUST
preserve the maintained v1 human/JSON contracts, `--check` / `--channel` /
dry-run plan shape, exit-code meanings, `NETWORK_ERROR` / `MANUAL_ACTION_REQUIRED` /
`UPGRADE_FAILED` codes, `qtx` / `quantex` binaries, empty dedicated alias set,
and state schema version 2. It MUST NOT wrap a published `createQuantex()`
`upgrade()` method into a second CLI-shaped API. This CLI ownership MUST NOT,
by itself, expand the published `quantex-core` method surface, change
`--channel` semantics, package/binary identity, or bump state schema version 2.

#### Scenario: Default upgrade invocation

- **WHEN** a user invokes `quantex upgrade` or `qtx upgrade`
- **THEN** Quantex plans and, when applicable, applies through the in-repo Core
  self-upgrade engine behind the frozen CLI contract
- **AND THEN** the published SDK does not gain an `upgrade` method solely
  because of this CLI routing change

#### Scenario: Machine-readable upgrade output

- **WHEN** `upgrade` runs with JSON output
- **THEN** the maintained v1 field names, types, and meanings remain unchanged
- **AND THEN** Core ownership of the upgrade path remains absent from the
  maintained output payloads

#### Scenario: Check and dry-run keep frozen plan shape

- **WHEN** `upgrade --check` or dry-run reports an available update
- **THEN** the payload keeps status `update-available` without mutation
- **AND THEN** `--check` still uses exit code 1 and dry-run still emits `DRY_RUN`

#### Scenario: Channel selection stays frozen

- **WHEN** `upgrade` runs with `--channel beta` or `--channel stable`
- **THEN** planning uses that channel
- **AND THEN** `--json` `data.channel` matches the selected value
- **AND THEN** engine or route identifiers remain absent from the payload

#### Scenario: Published SDK surface stays frozen for the upgrade knife

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI upgrade knife
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK `upgrade` method appears solely because CLI `upgrade`
  executes through in-repo Core

## MODIFIED Requirements

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall`, MUST launch CLI `exec` / shortcut through in-repo
Core execution without publishing SDK `run` / `exec` methods, and MUST diagnose
CLI `doctor` through in-repo Core without publishing SDK `doctor` / `diagnose`
methods. CLI `upgrade` MUST plan, check, and apply through in-repo Core without
publishing SDK `upgrade`. After the install/ensure escape retirement, Quantex
MUST NOT retain a second install/ensure engine route. Quantex MUST NOT expand
the published `quantex-core` public method surface as part of this CLI
promotion, and MUST NOT remove other maintained v1 surfaces before a separately
approved later-major deprecation change.

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

#### Scenario: User invokes upgrade after the P6 knife
- **WHEN** a user invokes `upgrade` during the 1.x line after this knife
- **THEN** Quantex plans, checks, and applies through the in-repo Core
  self-upgrade engine behind the frozen CLI contract
- **AND THEN** the published SDK does not gain an `upgrade` method

#### Scenario: Published SDK surface stays frozen for this slice
- **WHEN** a TypeScript consumer inspects the published `quantex-core` root export
  after the 1.12 CLI Core slices and the upgrade knife
- **THEN** `createQuantex()` still exposes only the previously published lifecycle
  methods
- **AND THEN** no new `update`, `uninstall`, `run`, `exec`, `doctor`,
  `diagnose`, or `upgrade` SDK method appears solely because the CLI now routes
  those operations through in-repo Core modules

#### Scenario: Unrelated v1 surface removal is proposed early
- **WHEN** a maintainer proposes deleting another maintained v1 surface that
  is outside this install/ensure escape retirement
- **THEN** the proposal remains subject to the separately approved later-major
  deprecation gate
