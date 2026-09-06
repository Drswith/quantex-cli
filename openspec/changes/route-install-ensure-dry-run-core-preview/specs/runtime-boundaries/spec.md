## MODIFIED Requirements

### Requirement: Install and ensure SHALL not retain a parallel legacy engine route

Quantex SHALL keep CLI `install` and `ensure` as thin projections over in-repo
Core for both apply and `--dry-run` after the 1.12 retirement of the
install/ensure whole-invocation escape and the P0 dry-run Core preview switch.
Those command modules MAY parse argv, project Core apply/preview outcomes into
maintained v1 human/JSON/NDJSON results, and apply exit policy. They MUST NOT
retain a second install/ensure apply engine selected by
`QUANTEX_INSTALLATION_ENGINE`. Install/ensure `--dry-run` MUST project Core
preview into the frozen dry-run contract and MUST NOT keep a selected
observation short-circuit planner route.

#### Scenario: Install or ensure has no env-selected second engine

- **WHEN** a user invokes `install` or `ensure` with
  `QUANTEX_INSTALLATION_ENGINE=legacy`
- **THEN** lifecycle ownership still executes through in-repo Core
- **AND THEN** the command module does not branch onto a retained legacy
  install/ensure engine

#### Scenario: Install or ensure dry-run projects Core preview

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** planning executes through Core preview
- **AND THEN** the CLI projects the frozen dry-run plan without invoking Core
  apply mutation
