## ADDED Requirements

### Requirement: Duplicate CLI engines relocated into Core SHALL be deleted

Quantex SHALL delete leftover duplicate CLI service/executor implementations
after a 1.12 CLI engine-swap slice moves lifecycle mutation, read observation,
execution, or diagnosis ownership into in-repo Core and the CLI facade is
confirmed to call Core. Promoted commands `install`, `ensure`, `update`,
`uninstall`, `list`, `inspect`, `info`, `resolve`, `exec`, and `doctor` MUST
remain thin projections (argv parsing, presentation, exit policy, and required
route selection) rather than retaining a second engine beside Core. Required
whole-invocation legacy wiring for `install` / `ensure` MUST remain until a
separately approved later-major deprecation.

#### Scenario: Cleanup removes a confirmed-dead duplicate update engine

- **WHEN** CLI `update` already plans and executes through in-repo Core
- **THEN** Quantex does not retain a second CLI service update engine that
  reimplements Core plan/execute ownership
- **AND THEN** the CLI update path remains a thin projector over Core

#### Scenario: Deprecated Core re-export shims are removed

- **WHEN** a former `src/services/*` module only re-exports an in-repo Core
  executor after ownership moved
- **THEN** callers import the Core module directly
- **AND THEN** the deprecated re-export shim is deleted

#### Scenario: Install/ensure legacy escape remains available

- **WHEN** cleanup deletes duplicate Core-owned engines
- **THEN** `QUANTEX_INSTALLATION_ENGINE=legacy` still selects the retained
  whole-invocation legacy route for `install` / `ensure`
- **AND THEN** v1 `--dry-run` planning for those commands remains on the
  retained legacy planning route

## MODIFIED Requirements

### Requirement: New lifecycle mutation behavior SHALL land in in-repo Core, not a thicker CLI

Quantex SHALL place new or relocated agent lifecycle mutation behavior for
`install`, `ensure`, `update`, and `uninstall` in in-repo Core modules under the
Core ownership boundary for the 1.12 CLI lifecycle slice. The CLI MUST remain a
thin compatibility shell for presentation and process policy. Relocating those
engines MUST NOT, by itself, expand the published `quantex-core` package export
surface. After relocation, Quantex MUST NOT keep a second CLI mutation engine
for a command whose Core ownership is already established, except for the
retained install/ensure whole-invocation legacy escape.

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

#### Scenario: Duplicate CLI mutation engine is cleaned up

- **WHEN** Core already owns `update` or `uninstall` mutation
- **THEN** Quantex deletes leftover duplicate CLI update/uninstall engine
  implementations for that ownership
- **AND THEN** only the thin CLI projection and required install/ensure legacy
  escape remain
