# installation-routing Specification

## Purpose

Define the stable routing contract between the Core lifecycle engine and the legacy compatibility engine for `install` and `ensure` invocations.
## Requirements
### Requirement: Install and ensure SHALL route whole invocations to one engine

Quantex SHALL keep Core as the pre-invocation default for CLI `install`,
`ensure`, `update`, and `uninstall`. The legacy engine SHALL remain available as
a whole-invocation compatibility route for `install` and `ensure` through an
exact `QUANTEX_INSTALLATION_ENGINE=legacy` override and through v1 `--dry-run`
planning. After the 1.12 relocation, `update` and `uninstall` MUST execute the
in-repo Core engine (no divergent second engine remains for those commands).
Quantex MUST NOT select Core for `run`, and MUST NOT fall back between engines
after an invocation begins.

#### Scenario: operator selects the legacy rollback route for install or ensure

- **WHEN** an operator starts `install` or `ensure` with
  `QUANTEX_INSTALLATION_ENGINE=legacy`
- **THEN** that new invocation uses the legacy engine from start to finish
- **AND THEN** a value other than the exact `legacy` override does not create a
  new routing mode

#### Scenario: dry-run has compatibility precedence for install and ensure

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run`, with or
  without the compatibility override
- **THEN** the invocation uses the retained legacy planning route
- **AND THEN** it does not start a Core lifecycle mutation

#### Scenario: update and uninstall default to Core

- **WHEN** an operator invokes `update` or `uninstall`
- **THEN** Quantex selects the in-repo Core engine before observation or
  mutation side effects begin
- **AND THEN** dry-run planning for those commands remains owned by that Core
  engine's existing no-side-effect path

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

### Requirement: Promoted CLI commands SHALL stay thin over in-repo Core

The CLI SHALL own argv parsing, human/JSON/NDJSON presentation, exit-code policy,
prompts, and route selection for the promoted lifecycle commands `install`,
`ensure`, `update`, `uninstall`, and the Core-backed `list` path, while the
in-repo Core engine owns observation, decision, mutation, verification, and
receipt persistence. The CLI MUST NOT re-implement those engine responsibilities
in the command module once Core is selected.

#### Scenario: Core route handles a promoted mutation

- **WHEN** the selected engine for a promoted mutation command is Core
- **THEN** the command module delegates lifecycle work through the Core
  compatibility bridge or Core read ports
- **AND THEN** it does not perform provider mutation or state persistence
  outside that Core path for the selected invocation

