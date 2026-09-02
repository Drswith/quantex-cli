## MODIFIED Requirements

### Requirement: Install and ensure SHALL route whole invocations to one engine

Quantex SHALL keep Core as the only whole-invocation engine for CLI `install`,
`ensure`, `update`, and `uninstall`. CLI `install` and `ensure` MUST select the
in-repo Core engine before observation or mutation, including when `--dry-run`
is set, and MUST NOT select a second engine through
`QUANTEX_INSTALLATION_ENGINE` or any other process-scoped override. After the
1.12 retirement of the install/ensure legacy escape, those commands MUST execute
Core's apply path for mutating invocations and Core's existing preview/dry-run
path for `--dry-run`, preserving the maintained v1 dry-run plan with no
lifecycle mutation. Quantex MUST NOT select Core for `run`, and MUST NOT fall
back between engines after an invocation begins.

#### Scenario: install or ensure always selects Core

- **WHEN** an operator invokes `install` or `ensure` with or without
  `QUANTEX_INSTALLATION_ENGINE` set
- **THEN** that invocation uses the in-repo Core engine from start to finish
- **AND THEN** an exact `legacy` environment value does not create a second
  routing mode

#### Scenario: dry-run for install or ensure uses Core preview

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run`
- **THEN** the invocation uses Core's existing preview/dry-run path
- **AND THEN** it retains the maintained v1 dry-run plan and does not start a
  lifecycle mutation

#### Scenario: update and uninstall default to Core

- **WHEN** an operator invokes `update` or `uninstall`
- **THEN** Quantex selects the in-repo Core engine before observation or
  mutation side effects begin
- **AND THEN** dry-run planning for those commands remains owned by that Core
  engine's existing no-side-effect path

### Requirement: Promoted CLI commands SHALL stay thin over in-repo Core

The CLI SHALL own argv parsing, human/JSON/NDJSON presentation, exit-code policy,
prompts, and route selection for the promoted lifecycle commands `install`,
`ensure`, `update`, `uninstall`, and the Core-backed `list` path, while the
in-repo Core engine owns observation, decision, mutation, verification, and
receipt persistence. The CLI MUST NOT re-implement those engine responsibilities
in the command module once Core is selected, and MUST NOT retain a parallel
legacy install/ensure engine route beside Core after the escape retirement.

#### Scenario: Core route handles a promoted mutation

- **WHEN** the selected engine for a promoted mutation command is Core
- **THEN** the command module delegates lifecycle work through the Core
  compatibility bridge or Core read ports
- **AND THEN** it does not perform provider mutation or state persistence
  outside that Core path for the selected invocation

#### Scenario: Install or ensure has no second engine route

- **WHEN** a user invokes CLI `install` or `ensure`
- **THEN** Quantex does not branch that invocation onto a retained legacy
  install/ensure engine
- **AND THEN** route diagnostics, when emitted, report Core only on debug
  stderr

## REMOVED Requirements

### Requirement: The Core-default rollback rehearsal is operator-repeatable

**Reason**: Product authorized retiring the `QUANTEX_INSTALLATION_ENGINE=legacy`
whole-invocation escape for install/ensure in the 1.12 eighth slice. The
rollback rehearsal existed only to exercise that escape and is no longer a
supported operator procedure.

**Migration**: Operators diagnose install/ensure regressions on the single
Core route. Capture command, provider, lock, state, cancellation, and timeout
evidence without switching engines mid-incident. Do not set
`QUANTEX_INSTALLATION_ENGINE` to select a second engine.
