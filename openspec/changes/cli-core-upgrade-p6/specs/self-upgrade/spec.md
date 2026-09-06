## ADDED Requirements

### Requirement: CLI upgrade SHALL plan, check, and apply through in-repo Core

Quantex SHALL execute CLI `upgrade` / `qtx upgrade` plan, `--check`, dry-run,
and apply through an in-repo Core self-upgrade engine. That engine MUST reuse
the existing self-upgrade domain modules for install-source inspection, target
resolution, provider mutation, verification, and recovery hints. It MUST NOT
model Quantex as an agent or share the agent-lifecycle `update` engine. The
published `quantex-core` package MUST NOT gain an `upgrade` method solely
because of this CLI routing change.

#### Scenario: Check does not mutate

- **GIVEN** an installable newer version is available
- **WHEN** the user runs `quantex upgrade --check`
- **THEN** Quantex plans through the in-repo Core self-upgrade engine
- **AND THEN** it does not invoke the self-upgrade mutator
- **AND THEN** the maintained `--json` payload keeps status `update-available`
  and exit code 1

#### Scenario: Dry-run does not mutate

- **GIVEN** an installable newer version is available
- **WHEN** the user runs `quantex upgrade --dry-run`
- **THEN** Quantex plans through the in-repo Core self-upgrade engine
- **AND THEN** it does not invoke the self-upgrade mutator
- **AND THEN** the maintained payload keeps status `update-available` and a
  `DRY_RUN` warning

#### Scenario: Apply uses the same Core invocation

- **GIVEN** an installable newer version is available from an auto-update source
- **WHEN** the user runs `quantex upgrade` without `--check` or `--dry-run`
- **THEN** Quantex plans and applies through the same in-repo Core self-upgrade
  engine
- **AND THEN** mutation still executes through the existing self-upgrade
  provider path
- **AND THEN** the published SDK does not gain an `upgrade` method

#### Scenario: Unresolved latest stays NETWORK_ERROR

- **GIVEN** self-upgrade inspection yields no installable latest version
- **WHEN** the user runs `quantex upgrade`, `quantex upgrade --check`, or dry-run
- **THEN** Quantex reports structured `NETWORK_ERROR` with status
  `check-unavailable`
- **AND THEN** it does not invoke the self-upgrade mutator

#### Scenario: Non-auto-update source stays MANUAL_ACTION_REQUIRED

- **GIVEN** the current install source cannot auto-update
- **WHEN** the user runs `quantex upgrade --check` or dry-run
- **THEN** Quantex reports structured `MANUAL_ACTION_REQUIRED`
- **AND THEN** it does not report `NETWORK_ERROR`
- **AND THEN** it does not invoke the self-upgrade mutator
