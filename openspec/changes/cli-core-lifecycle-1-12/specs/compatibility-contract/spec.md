## MODIFIED Requirements

### Requirement: Core-default installation routing remains a whole-invocation compatibility choice

For the 1.12 CLI lifecycle slice, Quantex SHALL select the in-repo Core engine by
default for non-dry-run `install` and `ensure`, and for `update` and `uninstall`,
before any lifecycle work begins. It MUST retain legacy routing for v1 `--dry-run`
planning on `install` / `ensure` and `QUANTEX_INSTALLATION_ENGINE=legacy` as a
process-scoped whole-invocation compatibility route for `install` / `ensure`,
MUST keep state schema version 2 unchanged, and MUST NOT automatically fall back
between engines after selection. Removing the retained install/ensure route
requires the documented soak, a later-major proposal, and its separate approval.

#### Scenario: Default install or ensure invocation

- **WHEN** a user invokes non-dry-run `install` or `ensure` without the
  compatibility environment override
- **THEN** Quantex selects the Core engine once before observation, locks,
  providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts

#### Scenario: Default update or uninstall invocation

- **WHEN** a user invokes `update` or `uninstall`
- **THEN** Quantex selects the in-repo Core engine once before observation,
  locks, providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts
- **AND THEN** the published `quantex-core` SDK does not gain `update` or
  `uninstall` methods solely because of this CLI routing change

#### Scenario: v1 dry-run planning for install or ensure

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** Quantex selects the retained legacy planning route before any
  lifecycle side effect
- **AND THEN** the result retains the maintained v1 dry-run plan and does not
  invoke Core for that request

#### Scenario: Operator uses the compatibility escape route for install or ensure

- **WHEN** an operator sets `QUANTEX_INSTALLATION_ENGINE=legacy` before
  invoking `install` or `ensure`
- **THEN** Quantex selects the retained legacy engine for the complete
  invocation before side effects begin
- **AND THEN** it does not invoke Core for that request

#### Scenario: Selected engine fails after a side effect begins

- **WHEN** either selected engine has started a provider, filesystem, or state
  side effect and then fails
- **THEN** Quantex completes that engine's verification or scoped recovery path
- **AND THEN** it does not invoke the other engine for the same request

#### Scenario: Machine-readable command output is requested

- **WHEN** a promoted lifecycle command runs with JSON or NDJSON output
- **THEN** the selected engine and route source remain absent from the
  maintained output payloads
- **AND THEN** route diagnostics are emitted only to debug stderr

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default CLI promotion for 1.12 MUST include `install`, `ensure`,
`update`, and `uninstall` while keeping `run` on its maintained implementation.
Quantex MUST NOT expand the published `quantex-core` public method surface as
part of this CLI promotion, and MUST NOT remove a v1 compatibility surface
before the staged soak and a separately approved later-major deprecation change.

#### Scenario: User invokes a non-promoted lifecycle command

- **WHEN** a user invokes `run` during the 1.x transition
- **THEN** Quantex retains its maintained existing implementation and public contract
- **AND THEN** the Core-default routing change does not expand that command's behavior or SDK surface

#### Scenario: Published SDK surface stays frozen for this slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root export
  after the 1.12 CLI lifecycle slice
- **THEN** `createQuantex()` still exposes only the previously published lifecycle
  methods
- **AND THEN** no new `update` or `uninstall` SDK method appears solely because
  the CLI now routes those commands through in-repo Core modules

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change
