## ADDED Requirements

### Requirement: Install and ensure SHALL not retain a parallel legacy engine route

Quantex SHALL keep CLI `install` and `ensure` as thin projections over in-repo
Core only after the 1.12 retirement of the install/ensure whole-invocation
escape. Those command modules MAY parse argv, project Core apply/preview
outcomes into maintained v1 human/JSON/NDJSON results, and apply exit policy.
They MUST NOT retain a second install/ensure apply engine selected by
`QUANTEX_INSTALLATION_ENGINE`. Install/ensure `--dry-run` MAY keep the
maintained v1 observation short-circuit planner until Core preview matches
those frozen contracts.

#### Scenario: Install or ensure has no env-selected second engine

- **WHEN** a user invokes `install` or `ensure` with
  `QUANTEX_INSTALLATION_ENGINE=legacy`
- **THEN** lifecycle ownership still executes through in-repo Core
- **AND THEN** the command module does not branch onto a retained legacy
  install/ensure engine

#### Scenario: Install or ensure dry-run stays on the retained planner

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** planning executes through the retained v1 observation short-circuit
  path
- **AND THEN** the CLI does not invoke Core apply mutation for that request

## MODIFIED Requirements

### Requirement: New lifecycle mutation behavior SHALL land in in-repo Core, not a thicker CLI

Quantex SHALL place new or relocated agent lifecycle mutation behavior for
`install`, `ensure`, `update`, and `uninstall` in in-repo Core modules under the
Core ownership boundary for the 1.12 CLI lifecycle slice. The CLI MUST remain a
thin compatibility shell for presentation and process policy. Relocating those
engines MUST NOT, by itself, expand the published `quantex-core` package export
surface. After the install/ensure escape retirement, Quantex MUST NOT keep a
second CLI install/ensure mutation or dry-run engine beside Core.

#### Scenario: Update or uninstall engine is selected

- **WHEN** the CLI selects Core for `update` or `uninstall`
- **THEN** the mutation engine executes from in-repo Core-owned modules
- **AND THEN** those modules remain absent from the published package root
  export unless a separately approved SDK change adds them

#### Scenario: CLI command module stays presentation-focused

- **WHEN** a promoted lifecycle command runs on the Core route
- **THEN** the command module may parse argv, choose the engine route, project
  Core outcomes into v1 human/JSON/NDJSON results, and apply exit policy
- **AND THEN** it does not become a second lifecycle engine implementation

#### Scenario: Install or ensure has no parallel legacy engine

- **WHEN** Core owns CLI `install` or `ensure`
- **THEN** Quantex does not retain a second install/ensure engine route for
  env escape or dry-run planning
- **AND THEN** only the thin CLI projection over Core remains for those
  commands
