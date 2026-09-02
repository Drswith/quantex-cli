# Compatibility Contract Specification

## Purpose

Preserve Quantex's established v1 distribution, CLI, machine-readable, state, standard-I/O, and root-library surfaces while internal lifecycle architecture evolves.
## Requirements
### Requirement: Distribution identity remains v1-compatible

The redesign SHALL preserve the existing package identity, executable binary names, and supported invocation entry points throughout the redesign and until a separate approved compatibility change explicitly ends the v1 compatibility window.

#### Scenario: Install a release containing the redesign

- **GIVEN** an existing installation or script refers to the current Quantex package and binary names
- **WHEN** it installs or invokes a release containing the redesigned internals
- **THEN** the same package and binary entry points remain available without migration to a v2 identity

### Requirement: The command surface remains v1-compatible

Quantex MUST preserve existing command names, aliases, argument and option contracts, defaults, and shortcut-launch behavior unless a separately approved compatibility change explicitly modifies them.

#### Scenario: Run an existing v1 command line

- **GIVEN** a command line is valid before the redesign
- **WHEN** the same command line is run against the redesigned release under equivalent conditions
- **THEN** Quantex accepts the same syntax and applies the same documented semantics

### Requirement: Machine-readable contracts remain v1-compatible

Quantex MUST preserve existing JSON output, command discovery, and schema field names, types, requiredness, meanings, and version semantics; the redesign MUST NOT remove, rename, or incompatibly reinterpret an existing field.

#### Scenario: Parse redesigned output with an existing consumer

- **GIVEN** a consumer accepts the current v1 JSON and schema contracts
- **WHEN** it processes equivalent output from the redesigned release
- **THEN** the consumer can parse and interpret the output without compatibility changes

### Requirement: Exit and standard-I/O behavior remains v1-compatible

Quantex MUST preserve exit-code meanings, stdout and stderr routing, interactive prompting behavior, and child-agent standard-I/O inheritance for equivalent invocations.

#### Scenario: Observe a command failure

- **GIVEN** an invocation fails under a condition with an established v1 exit code and output routing
- **WHEN** the equivalent failure occurs after the redesign
- **THEN** Quantex returns the same exit-code class and routes machine output and diagnostics to the same standard streams

#### Scenario: Launch an interactive agent

- **GIVEN** a shortcut invocation launches an installed interactive agent with inherited standard I/O
- **WHEN** the same shortcut is used after the redesign
- **THEN** the child agent retains the same interactive input, output, and error-stream behavior

### Requirement: Persisted state remains v1-compatible

Quantex MUST read state written before the redesign and SHALL write state that preserves existing identities, installation-source semantics, and consumer-visible fields without requiring a destructive reset.

#### Scenario: Reconcile from existing persisted state

- **GIVEN** a user has valid state produced by a pre-redesign v1 release
- **WHEN** the redesigned release performs a lifecycle operation
- **THEN** Quantex uses that state without manual migration and preserves its established meaning when recording the verified outcome

### Requirement: Root library exports have a compatibility facade

Existing public exports from the package root MUST remain importable through a compatibility facade throughout this redesign. Any later deprecation MUST identify a replacement and remain available for a separately documented and approved deprecation window before removal.

#### Scenario: Import an existing root export

- **GIVEN** a downstream v1 consumer imports a public symbol from the package root
- **WHEN** the consumer runs against a release containing the redesigned internals
- **THEN** the import remains valid and delegates to compatible behavior, including when the symbol has entered its documented deprecation window

### Requirement: The redesign supports incremental replacement

The modular-monolith redesign SHALL be deliverable in stages behind the v1 compatibility shell and MUST NOT require a big-bang v2 package, binary, command namespace, or persisted-state migration.

#### Scenario: Only part of the lifecycle engine has migrated

- **GIVEN** one lifecycle path uses redesigned internals while another still uses the prior internals
- **WHEN** users exercise either path through the v1 public surface
- **THEN** both paths honor the same compatibility contract without exposing the internal migration boundary

### Requirement: The redesign does not add workflow orchestration

The redesign MUST remain focused on Quantex agent lifecycle capabilities and SHALL NOT add batch workflows, stdin-pipe workflows, apply semantics, daemon mode, an MCP server, or other workflow-orchestration surfaces as part of this change.

#### Scenario: Inspect the public surface after the redesign

- **GIVEN** the lifecycle redesign has been applied
- **WHEN** a user or machine consumer inspects package, binary, command, discovery, and schema surfaces
- **THEN** no workflow-orchestration surface appears solely because of the internal rewrite

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
`update`, and `uninstall`, MUST launch CLI `exec` / shortcut through in-repo
Core execution without publishing SDK `run` / `exec` methods, and MUST diagnose
CLI `doctor` through in-repo Core without publishing SDK `doctor` / `diagnose`
methods. Quantex MUST NOT expand the published `quantex-core` public method
surface as part of this CLI promotion, and MUST NOT remove a v1 compatibility
surface before the staged soak and a separately approved later-major deprecation
change.

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

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change

### Requirement: A withdrawn catalog entry retains its v1 root export as frozen data

When an agent is withdrawn from the supported catalog and its name is part of the v1 root export snapshot, Quantex SHALL keep that symbol importable from the package root. The retained symbol is frozen data: it holds the agent definition as it stood at withdrawal, and it MUST NOT rejoin the catalog, appear in agent lookup, or be reachable from any lifecycle command.

This satisfies the compatibility facade without pretending the agent is still supported. Withdrawal removes the capability; the export survives only so downstream code that imports the symbol keeps compiling. Retained symbols SHALL be removed together as part of a future approved major change that ends the v1 export window, not individually as each agent is withdrawn.

A retained symbol MUST keep its declared type unchanged. Because the root declaration is pinned by exact bytes and digest, a change that reorders declarations MAY update that pin, but the change MUST record evidence that the declared types and the exported symbol set are unchanged.

#### Scenario: Importing a withdrawn agent

- **GIVEN** an agent has been withdrawn from the catalog
- **AND** its name was part of the v1 root export snapshot
- **WHEN** a downstream consumer imports that symbol from the package root
- **THEN** the import resolves and keeps its declared type
- **AND** the withdrawal is not a breaking change for that consumer

#### Scenario: A withdrawn agent is requested through the CLI

- **WHEN** a user or machine consumer looks up a withdrawn agent by canonical name or alias
- **THEN** Quantex reports it as an unknown agent
- **AND** the retained root export does not make it installable, updatable, or discoverable

#### Scenario: A withdrawn definition is mistaken for a catalog entry

- **WHEN** catalog listings, discovery output, or lifecycle planning enumerate supported agents
- **THEN** no retained withdrawn definition appears among them
- **AND** the retained definition is not the same object as any catalog entry

#### Scenario: Retiring the retained symbols

- **WHEN** a future approved major change ends the v1 root export window
- **THEN** the retained withdrawn symbols are removed together with the rest of that surface
- **AND** no separate deprecation window is required for each withdrawn agent, because the withdrawal already recorded one

#### Scenario: The pinned root declaration shifts without an API change

- **GIVEN** retaining a withdrawn symbol moves declarations within the emitted declaration file
- **WHEN** the change updates the pinned byte count and digest
- **THEN** it records that the declared types and the exported symbol set are unchanged
- **AND** the update is not treated as a v1 surface change

### Requirement: Free-form human-readable label prose is correctable; machine identifiers are frozen

Quantex distinguishes two kinds of value inside its v1 machine-readable payloads. A field declared as a free-form string whose contract is "human-readable description" carries prose: its wording MAY be corrected when it states something Quantex did not observe, provided the field's name, type, requiredness, and documented meaning are unchanged. A field whose value is a discriminator, enumerated identifier, or diagnostic code is a machine identifier: its value MUST NOT be renamed to track a prose correction, even when the identifier's wording becomes historical.

Correcting label prose SHALL be recorded in an approved change together with the pinned expectations it updates. A machine identifier whose name has become historical MUST be retained until a separately approved compatibility change ends its window, and its retention MUST NOT be treated as a defect merely because a related label was corrected.

#### Scenario: Correcting a human-readable label

- **GIVEN** a free-form human-readable label states a mechanism or origin Quantex did not observe
- **WHEN** an approved change corrects the label wording
- **THEN** the carrying field keeps its name, type, requiredness, and documented meaning
- **AND** the change records the correction and the pinned expectations it updates
- **AND** the correction is not treated as removing, renaming, or incompatibly reinterpreting the field

#### Scenario: A machine identifier's wording has become historical

- **GIVEN** a discriminator value, enumerated identifier, or diagnostic code contains wording that no longer describes the mechanism Quantex uses
- **WHEN** the related human-readable label is corrected
- **THEN** the identifier value is retained unchanged
- **AND** consumers keying on that identifier continue to match without a compatibility change

#### Scenario: Consumer distinguishes an untracked install

- **GIVEN** a consumer needs to detect that Quantex resolved an agent executable it does not track
- **WHEN** the consumer reads the structured resolution payload
- **THEN** the stable install-source discriminator identifies the untracked case
- **AND** the consumer does not need to string-match the human-readable source label

### Requirement: CLI read observation commands SHALL stay on in-repo Core ports without wrapping the public SDK

For the 1.12 CLI read-observation slice, Quantex SHALL observe agent state for
CLI `inspect`, `info`, `resolve`, and `list` through in-repo Core read ports.
Those commands MUST project the richer maintained v1 CLI human/JSON/NDJSON
contracts from Core observations and MUST NOT wrap public `createQuantex()`
`inspect()` or `list()` descriptors into a second CLI-shaped API. This CLI
ownership MUST NOT, by itself, expand the published `quantex-core` method
surface, change package/binary identity, bump state schema version 2, or alter
frozen command names, aliases, `--json` / `--output` fields, or exit-code
meanings.

#### Scenario: Default inspect, info, or resolve invocation

- **WHEN** a user invokes `inspect`, `info`, or `resolve` for a known agent
- **THEN** Quantex observes through in-repo Core read ports before projecting
  the maintained v1 CLI payload
- **AND THEN** the published SDK `inspect()` result type is not used as the
  CLI `--json` payload shape

#### Scenario: Machine-readable inspect, info, or resolve output

- **WHEN** `inspect`, `info`, or `resolve` runs with JSON or NDJSON output
- **THEN** the maintained v1 field names, types, and meanings remain unchanged
- **AND THEN** Core ownership of the observation path remains absent from the
  maintained output payloads

#### Scenario: Published SDK surface stays frozen for the read slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI read-observation slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK method appears solely because CLI `inspect`,
  `info`, or `resolve` observe through in-repo Core

### Requirement: CLI doctor SHALL diagnose through in-repo Core without a public SDK doctor method

For the 1.12 CLI doctor slice, Quantex SHALL synthesize environment diagnosis and
recovery guidance for CLI `doctor` through an in-repo Core diagnosis engine.
That entry point MUST preserve the maintained v1 human/JSON contracts, exit-code
meanings, empty alias set, installer key set, and issue machine identifiers, and
MUST NOT wrap a published `createQuantex()` `doctor()` / `diagnose()` method into
a second CLI-shaped API. This CLI ownership MUST NOT, by itself, expand the
published `quantex-core` method surface, change package/binary identity, bump
state schema version 2, or alter frozen command names, aliases, `--json` /
`--output` fields, or exit-code meanings.

#### Scenario: Default doctor invocation

- **WHEN** a user invokes `quantex doctor`
- **THEN** Quantex gathers installer/self/agent observations through the CLI
  bridge and synthesizes issues through the in-repo Core diagnosis engine
- **AND THEN** the published SDK does not gain a `doctor` or `diagnose` method
  solely because of this CLI routing change

#### Scenario: Machine-readable doctor output

- **WHEN** `doctor` runs with JSON output
- **THEN** the maintained v1 field names, types, meanings, installer keys, and
  issue machine identifiers remain unchanged
- **AND THEN** Core ownership of the diagnosis path remains absent from the
  maintained output payloads

#### Scenario: Doctor success exit policy stays frozen

- **WHEN** `doctor` completes observation and diagnosis successfully
- **THEN** Quantex exits with code 0
- **AND THEN** any `blocking` issue remains a structured data field rather than
  a new non-zero exit meaning for this slice

#### Scenario: Published SDK surface stays frozen for the doctor slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI doctor slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK `doctor` or `diagnose` method appears solely because
  CLI `doctor` diagnoses through in-repo Core

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

