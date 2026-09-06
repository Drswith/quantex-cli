## MODIFIED Requirements

### Requirement: Core-default installation routing remains a whole-invocation compatibility choice

Quantex SHALL select the in-repo Core engine for every CLI `install` and
`ensure` invocation (apply and `--dry-run`), and for `update` and `uninstall`,
before any lifecycle work begins after the install/ensure escape retirement and
the P0 dry-run Core preview switch. Install/ensure `--dry-run` MUST use Core
preview, MUST retain the maintained v1 dry-run plan without lifecycle mutation,
and MUST keep that plan frozen when provider observation is indeterminate.
Quantex MUST NOT honor `QUANTEX_INSTALLATION_ENGINE=legacy` (or any other value)
as a second install/ensure engine route, MUST keep state schema version 2
unchanged, and MUST NOT automatically fall back between engines after selection.

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

#### Scenario: v1 dry-run planning for install or ensure via Core preview

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** Quantex selects Core preview before any lifecycle side effect
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
