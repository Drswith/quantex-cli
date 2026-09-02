## ADDED Requirements

### Requirement: 1.12 Core cleanup SHALL freeze contracts and retain install/ensure legacy escape

For the 1.12 CLI Core cleanup slice, Quantex SHALL delete leftover duplicate CLI
lifecycle/service/executor implementations after ownership moved into in-repo
Core, while freezing package/binary identity, state schema version 2, command
names/aliases, `--json` / `--output` fields, exit-code meanings, and the
published `quantex-core` method surface. Quantex MUST retain
`QUANTEX_INSTALLATION_ENGINE=legacy` as a whole-invocation compatibility escape
for `install` / `ensure`, MUST keep v1 `--dry-run` planning on the retained
legacy route for those commands, and MUST NOT change behavior of `upgrade`,
`config`, `capabilities`, `commands`, or `schema` as part of this cleanup.

#### Scenario: Cleanup-only delivery

- **WHEN** maintainers ship the 1.12 Core cleanup slice
- **THEN** promoted CLI commands remain thin projections over in-repo Core
- **AND THEN** user-facing commands, aliases, `--json` contracts, exit codes,
  and state schema version 2 remain unchanged

#### Scenario: Legacy install/ensure escape stays available after cleanup

- **WHEN** an operator sets `QUANTEX_INSTALLATION_ENGINE=legacy` before
  `install` or `ensure`
- **THEN** Quantex selects the retained legacy engine for the complete
  invocation
- **AND THEN** cleanup does not remove that whole-invocation escape

#### Scenario: Out-of-scope stable commands stay unchanged

- **WHEN** a user invokes `upgrade`, `config`, `capabilities`, `commands`, or
  `schema` after the cleanup slice
- **THEN** those commands keep their pre-cleanup behavior and contracts
- **AND THEN** cleanup does not relocate or rewrite those surfaces

#### Scenario: Published SDK surface stays frozen for the cleanup slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this cleanup
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK method appears solely because duplicate CLI engines
  were deleted

## MODIFIED Requirements

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall`, MUST launch CLI `exec` / shortcut through in-repo
Core execution without publishing SDK `run` / `exec` methods, and MUST diagnose
CLI `doctor` through in-repo Core without publishing SDK `doctor` / `diagnose`
methods. After those ownership moves, Quantex MUST delete leftover duplicate CLI
engines for the promoted paths while retaining the install/ensure whole-
invocation legacy escape through the staged soak. Quantex MUST NOT expand the
published `quantex-core` public method surface as part of this CLI promotion or
cleanup, and MUST NOT remove a v1 compatibility surface before the staged soak
and a separately approved later-major deprecation change.

#### Scenario: User invokes doctor during the 1.12 transition

- **WHEN** a user invokes `doctor` during the 1.x transition after this slice
- **THEN** Quantex diagnoses through the in-repo Core diagnosis engine behind
  the frozen CLI contract
- **AND THEN** the published SDK does not gain a `doctor` or `diagnose` method

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
- **AND THEN** no new `update`, `uninstall`, `run`, `exec`, `doctor`, or
  `diagnose` SDK method appears solely because the CLI now routes those
  operations through in-repo Core modules

#### Scenario: Cleanup deletes duplicate engines without removing legacy escape

- **WHEN** maintainers delete leftover duplicate CLI engines after Core
  ownership is established
- **THEN** promoted commands remain thin projections over Core
- **AND THEN** the retained `QUANTEX_INSTALLATION_ENGINE=legacy` install/ensure
  escape remains available
- **AND THEN** retained CLI observation/lock compatibility wiring used by those
  projections is not deleted merely because the duplicate invocation engine is
  removed

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change
