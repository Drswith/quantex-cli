## MODIFIED Requirements

### Requirement: Core-default installation routing remains a whole-invocation compatibility choice

Quantex SHALL select the in-repo Core engine for every non-dry-run CLI
`install` and `ensure` invocation, and for `update` and `uninstall`, before any
lifecycle work begins after the install/ensure escape retirement. Install/
ensure `--dry-run` MUST retain the maintained v1 observation short-circuit
planning path and MUST retain the maintained v1 dry-run plan without lifecycle
mutation. Quantex MUST NOT honor `QUANTEX_INSTALLATION_ENGINE=legacy` (or any
other value) as a second install/ensure apply engine route, MUST keep state
schema version 2 unchanged, and MUST NOT automatically fall back between
engines after selection.

#### Scenario: Default install or ensure invocation

- **WHEN** a user invokes non-dry-run `install` or `ensure`
- **THEN** Quantex selects the Core engine once before observation, locks,
  providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts

#### Scenario: Default update or uninstall invocation

- **WHEN** a user invokes `update` or `uninstall`
- **THEN** Quantex selects the in-repo Core engine once before observation,
  locks, providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts
- **AND THEN** the published `quantex-core` SDK does not gain `update` or
  `uninstall` methods solely because of this CLI routing change

#### Scenario: v1 dry-run planning for install or ensure

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** Quantex selects the retained v1 observation short-circuit planning
  path before any lifecycle side effect
- **AND THEN** the result retains the maintained v1 dry-run plan and does not
  mutate providers, filesystem, or state

#### Scenario: Legacy environment override no longer selects a second apply engine

- **WHEN** an operator sets `QUANTEX_INSTALLATION_ENGINE=legacy` before
  invoking non-dry-run `install` or `ensure`
- **THEN** Quantex still selects the in-repo Core engine for the complete
  apply invocation
- **AND THEN** the environment value does not create a retained legacy apply
  route

#### Scenario: Selected engine fails after a side effect begins

- **WHEN** the selected Core engine has started a provider, filesystem, or
  state side effect and then fails
- **THEN** Quantex completes that engine's verification or scoped recovery path
- **AND THEN** it does not invoke a second install/ensure engine for the same
  request

#### Scenario: Machine-readable command output is requested

- **WHEN** a promoted lifecycle command runs with JSON or NDJSON output
- **THEN** the selected engine and route source remain absent from the
  maintained output payloads
- **AND THEN** route diagnostics are emitted only to debug stderr

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall`, MUST launch CLI `exec` / shortcut through in-repo
Core execution without publishing SDK `run` / `exec` methods, and MUST diagnose
CLI `doctor` through in-repo Core without publishing SDK `doctor` / `diagnose`
methods. After the install/ensure escape retirement, Quantex MUST NOT retain a
second install/ensure engine route. Quantex MUST NOT expand the published
`quantex-core` public method surface as part of this CLI promotion, and MUST
NOT remove other maintained v1 surfaces before a separately approved
later-major deprecation change.

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

#### Scenario: Unrelated v1 surface removal is proposed early

- **WHEN** a maintainer proposes deleting another maintained v1 surface that
  is outside this install/ensure escape retirement
- **THEN** the proposal remains subject to the separately approved later-major
  deprecation gate
