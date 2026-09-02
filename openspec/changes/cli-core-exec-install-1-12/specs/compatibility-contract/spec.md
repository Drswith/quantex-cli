## ADDED Requirements

### Requirement: Exec --install SHALL mutate through Core install/ensure without drifting frozen contracts

Quantex SHALL perform authorized missing-agent installation for CLI `exec` or
shortcut through the in-repo Core install/ensure engine used by CLI `install` /
`ensure`. The public `--install` enum MUST remain `never` / `if-missing` /
`always` with default `never` on the public flag surface; interactive `prompt`
MUST remain interactive-only and MUST NOT become a JSON policy value.
Maintained `--json` payloads, human/interactive stdio inherit, and exit-code
meanings MUST remain unchanged and MUST NOT expose engine or route identifiers.
This routing MUST NOT expand the published `quantex-core` method surface.

#### Scenario: Public install policy enum stays frozen

- **WHEN** a user inspects `exec --install` help or structured command metadata
- **THEN** the public policy values remain `never`, `if-missing`, and `always`
- **AND THEN** `prompt` is not advertised as a JSON policy value

#### Scenario: Exec install-if-missing uses Core without JSON engine leakage

- **WHEN** `exec` runs with `--install if-missing` and JSON or NDJSON output
- **THEN** a required missing-agent install mutates through Core install/ensure
- **AND THEN** maintained payload field names, types, and meanings remain
  unchanged
- **AND THEN** engine or route identifiers remain absent from those payloads

#### Scenario: Human interactive launch keeps inherited stdio after Core install

- **WHEN** `exec` or shortcut installs then launches in human output mode
- **THEN** the agent process still inherits stdin, stdout, and stderr
- **AND THEN** exit-code meanings remain unchanged from the pre-slice contract

#### Scenario: Published SDK surface stays frozen for the exec-install slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK `run`, `exec`, or install-port method appears solely
  because exec `--install` now uses Core install/ensure

## MODIFIED Requirements

### Requirement: CLI exec and shortcut SHALL launch through in-repo Core execution without a public SDK run method

For the 1.12 CLI exec slice, Quantex SHALL execute managed agent launch for
CLI `exec` and shortcut `qtx <agent> [args...]` through an in-repo Core
execution engine. When `--install` authorizes installing a missing agent before
launch, that mutation MUST use the in-repo Core install/ensure engine rather
than a retained lifecycle reconcile port. Those entry points MUST preserve the
maintained v1 human/JSON contracts, exit-code meanings, and `--install` policy
semantics, and MUST NOT wrap a published `createQuantex()` `run()` / `exec()`
method into a second CLI-shaped API. This CLI ownership MUST NOT, by itself,
expand the published `quantex-core` method surface, change package/binary
identity, bump state schema version 2, or alter frozen command names, aliases,
`--json` / `--output` fields, or exit-code meanings.

#### Scenario: Default exec invocation with install policy

- **WHEN** a user invokes `quantex exec <agent> --install <policy> -- [args...]`
- **THEN** Quantex applies the selected `--install` policy through the in-repo
  Core execution engine before launching the agent
- **AND THEN** any authorized missing-agent install mutates through Core
  install/ensure
- **AND THEN** the published SDK does not gain a `run` or `exec` method solely
  because of this CLI routing change

#### Scenario: Shortcut agent launch

- **WHEN** a user invokes shortcut `qtx <agent> [args...]` for a known agent
- **THEN** Quantex launches through the same in-repo Core execution engine used
  by `exec`
- **AND THEN** argv parsing, presentation, and exit policy remain CLI-owned

#### Scenario: Machine-readable exec preflight output

- **WHEN** `exec` runs with JSON or NDJSON output for a not-installed or
  interaction-required outcome
- **THEN** the maintained v1 field names, types, and meanings remain unchanged
- **AND THEN** Core ownership of the launch path remains absent from the
  maintained output payloads

#### Scenario: Published SDK surface stays frozen for the exec slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI exec slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK `run` or `exec` method appears solely because CLI
  `exec` / shortcut launch through in-repo Core
