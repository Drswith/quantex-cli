## MODIFIED Requirements

### Requirement: Promoted CLI commands SHALL stay thin over in-repo Core

The CLI SHALL own argv parsing, human/JSON/NDJSON presentation, exit-code policy,
prompts, and route selection for the promoted lifecycle commands `install`,
`ensure`, `update`, `uninstall`, the Core-backed read commands `list`,
`inspect`, `info`, and `resolve`, and the Core-backed `exec` / `doctor` paths,
while the in-repo Core engine owns observation, decision, mutation,
verification, receipt persistence, launch, and diagnosis for those routes. The
CLI MUST NOT re-implement those engine responsibilities in the command module
or a parallel `src/services` executor once Core is selected. After ownership
moves into Core, leftover duplicate CLI lifecycle/service/executor
implementations for those routes MUST be deleted, except for the retained
whole-invocation legacy escape used by `install` / `ensure`.

#### Scenario: Core route handles a promoted mutation

- **WHEN** the selected engine for a promoted mutation command is Core
- **THEN** the command module delegates lifecycle work through the Core
  compatibility bridge or Core read ports
- **AND THEN** it does not perform provider mutation or state persistence
  outside that Core path for the selected invocation

#### Scenario: Cleanup removes a parallel service engine

- **WHEN** Core already owns a promoted command's engine responsibilities
- **THEN** Quantex deletes leftover duplicate CLI service/executor engines for
  that command
- **AND THEN** the CLI path remains a thin projection over Core

#### Scenario: Install/ensure legacy escape is not treated as a duplicate Core engine

- **WHEN** an operator selects `QUANTEX_INSTALLATION_ENGINE=legacy` for
  `install` or `ensure`
- **THEN** the retained legacy engine remains available as the whole-invocation
  compatibility route
- **AND THEN** that escape is not deleted merely because Core is the default
  route
