## ADDED Requirements

### Requirement: CLI exec and shortcut SHALL launch through in-repo Core execution without a public SDK run method

For the 1.12 CLI exec slice, Quantex SHALL execute managed agent launch for
CLI `exec` and shortcut `qtx <agent> [args...]` through an in-repo Core
execution engine. Those entry points MUST preserve the maintained v1 human/JSON
contracts, exit-code meanings, and `--install` policy semantics, and MUST NOT
wrap a published `createQuantex()` `run()` / `exec()` method into a second
CLI-shaped API. This CLI ownership MUST NOT, by itself, expand the published
`quantex-core` method surface, change package/binary identity, bump state
schema version 2, or alter frozen command names, aliases, `--json` / `--output`
fields, or exit-code meanings.

#### Scenario: Default exec invocation with install policy

- **WHEN** a user invokes `quantex exec <agent> --install <policy> -- [args...]`
- **THEN** Quantex applies the selected `--install` policy through the in-repo
  Core execution engine before launching the agent
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

## MODIFIED Requirements

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall`, and MUST launch CLI `exec` / shortcut through
in-repo Core execution without publishing SDK `run` / `exec` methods.
Quantex MUST NOT expand the published `quantex-core` public method surface as
part of this CLI promotion, and MUST NOT remove a v1 compatibility surface
before the staged soak and a separately approved later-major deprecation change.

#### Scenario: User invokes exec or shortcut during the 1.12 transition

- **WHEN** a user invokes `exec` or shortcut `qtx <agent>` during the 1.x
  transition after this slice
- **THEN** Quantex launches through the in-repo Core execution engine behind
  the frozen CLI contract
- **AND THEN** the published SDK does not gain a `run` or `exec` method

#### Scenario: Published SDK surface stays frozen for this slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root export
  after the 1.12 CLI Core slices
- **THEN** `createQuantex()` still exposes only the previously published lifecycle
  methods
- **AND THEN** no new `update`, `uninstall`, `run`, or `exec` SDK method appears
  solely because the CLI now routes those operations through in-repo Core modules

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change
