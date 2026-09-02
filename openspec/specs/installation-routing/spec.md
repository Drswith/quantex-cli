# installation-routing Specification

## Purpose

Define the stable routing contract between the Core lifecycle engine and the legacy compatibility engine for `install` and `ensure` invocations.
## Requirements
### Requirement: Install and ensure SHALL route whole invocations to one engine

Quantex SHALL keep Core as the only whole-invocation apply engine for CLI
`install`, `ensure`, `update`, and `uninstall`. CLI `install` and `ensure`
MUST select the in-repo Core engine before observation or mutation for
non-dry-run invocations, and MUST NOT select a second apply engine through
`QUANTEX_INSTALLATION_ENGINE` or any other process-scoped override. Install/
ensure `--dry-run` MUST retain the maintained v1 observation short-circuit
planning path that produces the frozen dry-run plan with no lifecycle mutation;
Core preview MUST NOT replace that path until it matches those frozen contracts.
Quantex MUST NOT select Core for `run`, and MUST NOT fall back between engines
after an invocation begins.

#### Scenario: install or ensure always selects Core for apply

- **WHEN** an operator invokes non-dry-run `install` or `ensure` with or without
  `QUANTEX_INSTALLATION_ENGINE` set
- **THEN** that invocation uses the in-repo Core engine from start to finish
- **AND THEN** an exact `legacy` environment value does not create a second
  apply routing mode

#### Scenario: dry-run for install or ensure keeps the maintained planning path

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run`
- **THEN** the invocation uses the retained v1 observation short-circuit
  planning path
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
receipt persistence. Exec/shortcut presentation remains CLI-owned, and authorized
exec install-before-launch mutation MUST also delegate to the Core install/ensure
engine. The CLI MUST NOT re-implement those engine responsibilities in the
command module once Core is selected, and MUST NOT retain a parallel legacy
install/ensure engine route beside Core after the escape retirement.

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

#### Scenario: Exec install-before-launch has no second install engine

- **WHEN** `exec` or shortcut installs a missing agent before launch
- **THEN** mutation executes through Core install/ensure
- **AND THEN** the CLI does not retain a parallel lifecycle reconcile install
  engine for that path

### Requirement: Exec and shortcut install-if-missing SHALL use the Core install/ensure engine

Quantex SHALL route authorized missing-agent installation for CLI `exec` and
shortcut through the same in-repo Core install/ensure engine used by CLI
`install` / `ensure`. That path is not selected through
`selectInstallationEngineRoute` for management commands; it is owned by the
exec/shortcut production bridge. Quantex MUST NOT keep a parallel
`reconcileAgentInstallation` install mutation for exec after this slice.

#### Scenario: Exec install port selects Core installation

- **WHEN** the exec/shortcut production bridge must install a missing agent
- **THEN** it invokes the Core install/ensure compatibility bridge
- **AND THEN** it does not call `reconcileAgentInstallation`

