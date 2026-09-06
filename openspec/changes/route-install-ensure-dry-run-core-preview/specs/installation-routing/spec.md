## MODIFIED Requirements

### Requirement: Install and ensure SHALL route whole invocations to one engine

Quantex SHALL keep Core as the only whole-invocation engine for CLI
`install`, `ensure`, `update`, and `uninstall`. CLI `install` and `ensure`
MUST select the in-repo Core engine before observation or mutation for both
apply and `--dry-run` invocations, and MUST NOT select a second engine through
`QUANTEX_INSTALLATION_ENGINE` or any other process-scoped override. Install/
ensure `--dry-run` MUST execute through Core preview, MUST emit the frozen
dry-run plan (`DRY_RUN` or equivalent frozen fields, `changed: false`, preserved
human exit codes and `--json` shape), and MUST NOT start lifecycle mutation.
When provider observation is indeterminate, Core preview MUST still produce that
frozen dry-run plan rather than failing closed with an apply-time indeterminate
error. Quantex MUST NOT select Core for `run`, and MUST NOT fall back between
engines after an invocation begins.

#### Scenario: install or ensure always selects Core for apply

- **WHEN** an operator invokes non-dry-run `install` or `ensure` with or without
  `QUANTEX_INSTALLATION_ENGINE` set
- **THEN** that invocation uses the in-repo Core engine from start to finish
- **AND THEN** an exact `legacy` environment value does not create a second
  apply routing mode

#### Scenario: dry-run for install or ensure uses Core preview

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run`
- **THEN** the invocation selects Core preview before observation side effects
  begin
- **AND THEN** it emits the frozen dry-run plan and does not start a lifecycle
  mutation

#### Scenario: dry-run remains frozen under indeterminate provider observation

- **WHEN** an operator invokes `install` or `ensure` with `--dry-run` and
  provider observation is indeterminate (for example empty `PATH`)
- **THEN** Core preview still emits the frozen dry-run plan with `changed:
  false` and `DRY_RUN` (or equivalent frozen fields)
- **AND THEN** the command does not surface an apply-time
  decision-indeterminate failure in place of that plan

#### Scenario: update and uninstall default to Core

- **WHEN** an operator invokes `update` or `uninstall`
- **THEN** Quantex selects the in-repo Core engine before observation or
  mutation side effects begin
- **AND THEN** dry-run planning for those commands remains owned by that Core
  engine's existing no-side-effect path
