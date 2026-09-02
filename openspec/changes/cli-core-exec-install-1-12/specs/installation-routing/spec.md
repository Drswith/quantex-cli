## ADDED Requirements

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

## MODIFIED Requirements

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
