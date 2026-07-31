# core-installation-soak Specification

## Purpose
TBD - created by archiving change freeze-legacy-installation-engine. Update Purpose after archive.
## Requirements
### Requirement: The second Core-default soak freezes the selected installation boundary

During the 1.5 soak, Quantex SHALL keep Core as the pre-invocation default for
non-dry-run `install` and `ensure`. The legacy engine SHALL remain frozen as a
whole-invocation compatibility route only for v1 dry-run planning and an exact
`QUANTEX_INSTALLATION_ENGINE=legacy` override. Quantex MUST NOT select Core
for `update`, `uninstall`, or `run`, and MUST NOT fall back between engines
after an invocation begins.

#### Scenario: operator selects the legacy rollback route

- **WHEN** an operator starts `install` or `ensure` with
  `QUANTEX_INSTALLATION_ENGINE=legacy`
- **THEN** that new invocation uses the legacy engine from start to finish
- **AND THEN** a value other than the exact `legacy` override does not create a
  new routing mode

#### Scenario: dry-run has compatibility precedence

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run`, with or
  without the compatibility override
- **THEN** the invocation uses the retained legacy planning route
- **AND THEN** it does not start a Core lifecycle mutation

### Requirement: The Core-default rollback rehearsal is operator-repeatable

Quantex SHALL document a rollback rehearsal that proves the existing
whole-invocation legacy route, records observable command and state evidence,
and returns to the Core default in a later invocation. The procedure MUST NOT
recommend switching engines after a provider, filesystem, or state side effect
has started.

#### Scenario: operator follows the rollback rehearsal

- **WHEN** an operator follows the documented procedure for one promoted
  command
- **THEN** it can verify the legacy invocation and the subsequent Core-default
  invocation independently
- **AND THEN** the procedure preserves state schema version 2 and does not
  require an automatic rollback
