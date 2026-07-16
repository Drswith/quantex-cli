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
