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

For the 1.4 promotion and 1.5 second stable-minor soak, Quantex SHALL select
the Core engine by default for non-dry-run `install` and `ensure` before any
lifecycle work begins. It MUST retain legacy routing for v1 `--dry-run`
planning and `QUANTEX_INSTALLATION_ENGINE=legacy` as a process-scoped
whole-invocation compatibility route through the full 1.5 soak, MUST keep state
schema version 2 unchanged, and MUST NOT automatically fall back between
engines after selection. Removing the retained route requires the documented
soak, a later-major proposal, and its separate approval.

#### Scenario: Default install or ensure invocation

- **WHEN** a user invokes non-dry-run `install` or `ensure` without the
  compatibility environment override
- **THEN** Quantex selects the Core engine once before observation, locks,
  providers, filesystem, or state side effects
- **AND THEN** the invocation preserves the maintained v1 command, output,
  exit, and state contracts

#### Scenario: v1 dry-run planning

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** Quantex selects the retained legacy planning route before any
  lifecycle side effect
- **AND THEN** the result retains the maintained v1 dry-run plan and does not
  invoke Core for that request

#### Scenario: Operator uses the compatibility escape route

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

- **WHEN** `install` or `ensure` runs with JSON or NDJSON output
- **THEN** the selected engine and route source remain absent from the
  maintained output payloads
- **AND THEN** route diagnostics are emitted only to debug stderr

### Requirement: Core routing promotion remains bounded by the staged compatibility runway

The Core-default promotion MUST apply only to `install` and `ensure`. Quantex MUST retain the maintained legacy implementations for `update`, `uninstall`, and `run`, and MUST NOT remove a v1 compatibility surface before the second Core-default stable minor and a separately approved later-major deprecation change.

#### Scenario: User invokes a non-promoted lifecycle command

- **WHEN** a user invokes `update`, `uninstall`, or `run` during the 1.x transition
- **THEN** Quantex retains its maintained existing implementation and public contract
- **AND THEN** the Core-default routing change does not expand that command's behavior or SDK surface

#### Scenario: Legacy removal is proposed early

- **WHEN** a maintainer proposes deleting the retained legacy route or another maintained v1 surface before the staged soak and later-major decision complete
- **THEN** the proposal is rejected as outside this promotion change
