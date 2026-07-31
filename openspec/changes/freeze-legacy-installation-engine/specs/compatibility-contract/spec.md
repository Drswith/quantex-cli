## MODIFIED Requirements

### Requirement: Core-default installation routing remains a whole-invocation compatibility choice

For the 1.4 promotion and 1.5 second stable-minor soak, Quantex SHALL select
the Core engine by default for non-dry-run `install` and `ensure` before any
lifecycle work begins. It MUST retain legacy routing for v1 `--dry-run`
planning and `QUANTEX_INSTALLATION_ENGINE=legacy` as a process-scoped
whole-invocation compatibility route through the full 1.5 soak, MUST keep state
schema version 2 unchanged, and MUST NOT automatically fall back between
engines after selection. Removing the retained route requires the documented
soak, a later-major proposal, and its separate approval.

#### Scenario: Default install or ensure invocation

- **WHEN** a user invokes non-dry-run `install` or `ensure` without the
  compatibility environment override
- **THEN** Quantex selects the Core engine once before observation, locks,
  providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts

#### Scenario: v1 dry-run planning

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** Quantex selects the retained legacy planning route before any
  lifecycle side effect
- **AND THEN** the result retains the maintained v1 dry-run plan and does not
  invoke Core for that request

#### Scenario: Operator uses the compatibility escape route

- **WHEN** an operator sets `QUANTEX_INSTALLATION_ENGINE=legacy` before
  invoking `install` or `ensure`
- **THEN** Quantex selects the retained legacy engine for the complete
  invocation before side effects begin
- **AND THEN** it does not invoke Core for that request

#### Scenario: Selected engine fails after a side effect begins

- **WHEN** either selected engine has started a provider, filesystem, or state
  side effect and then fails
- **THEN** Quantex completes that engine's verification or scoped recovery path
- **AND THEN** it does not invoke the other engine for the same request

#### Scenario: Machine-readable command output is requested

- **WHEN** `install` or `ensure` runs with JSON or NDJSON output
- **THEN** the selected engine and route source remain absent from the
  maintained output payloads
- **AND THEN** route diagnostics are emitted only to debug stderr
