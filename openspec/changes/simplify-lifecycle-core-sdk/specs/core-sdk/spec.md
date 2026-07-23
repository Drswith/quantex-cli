## ADDED Requirements

### Requirement: Core SDK is an independently consumable TypeScript package

Quantex SHALL publish one ESM TypeScript Core SDK package with declarations and a documented public root entry point that can be installed without consuming the CLI binary or compatibility root exports.

#### Scenario: Node consumer imports the packed SDK

- **GIVEN** a clean Node.js 20 consumer has installed the packed Core SDK
- **WHEN** it imports the documented root entry point
- **THEN** the import succeeds without installing or invoking the Quantex CLI binary
- **AND** TypeScript NodeNext compilation resolves the documented public types

#### Scenario: Bun consumer imports the packed SDK

- **GIVEN** a clean Bun consumer has installed the packed Core SDK
- **WHEN** it imports the documented root entry point
- **THEN** the same supported public API is available without repository-local path aliases or symlinks

### Requirement: Core SDK exposes an instance-owned lifecycle client

The Core SDK MUST expose `createQuantex` as its client factory, and each created client and method invocation MUST own its configuration, cancellation, timeout, and cleanup state without relying on mutable CLI process globals.

#### Scenario: Two consumers run concurrently

- **GIVEN** two Core clients or invocations use different abort signals, timeouts, or configuration directories
- **WHEN** their lifecycle reads execute concurrently in one process
- **THEN** cancellation or configuration from one invocation does not affect the other

#### Scenario: Consumer supplies an isolated configuration directory

- **WHEN** a consumer creates a Core client with an explicit configuration directory
- **THEN** Core resolves its configuration and state under that directory
- **AND** it does not mutate the process-wide CLI context

### Requirement: Core SDK adds only implemented lifecycle methods

The first stable Core SDK release SHALL expose `list` and `inspect`; later minor releases MAY add `install`, `ensure`, `update`, `uninstall`, and `run` only after each method satisfies its migration gates. The SDK MUST NOT publish placeholder lifecycle methods whose only implementation is an unsupported response.

#### Scenario: Consumer inspects the first stable client surface

- **WHEN** a consumer compiles against the first stable Core SDK release
- **THEN** every published lifecycle method has a functional implementation and documented result contract
- **AND** unimplemented future mutation methods are absent rather than frozen as placeholders

#### Scenario: A mutation method is added in a later minor

- **GIVEN** a lifecycle method has passed its provider, compatibility, state, cancellation, and differential gates
- **WHEN** a later compatible minor release adds that method
- **THEN** existing Core consumers remain source-compatible
- **AND** the new method follows the same instance and result conventions

#### Scenario: Install and ensure are introduced in 1.3

- **WHEN** the 1.3 Core SDK adds `install` and `ensure`
- **THEN** both methods accept the same explicit preview-or-apply mutation options
- **AND** both return the same compact mutation-result contract rather than exposing separate command-shaped payloads

### Requirement: Core install and ensure expose compact mutation decisions

Core `install` and `ensure` MUST return a serializable mutation result containing the current inspection, one of `already-satisfied`, `external-preserved`, `install`, or `reinstall`, and only the source evidence needed to explain that decision. Preview MUST report `wouldChange` without fabricating a post-mutation inspection; apply MUST report `changed` and a freshly observed post-mutation inspection. Apply SHALL be the SDK default when mode is omitted.

#### Scenario: Consumer previews a missing agent

- **GIVEN** Core conclusively observes a missing agent and resolves one supported install recipe
- **WHEN** the consumer calls `install` or `ensure` with preview mode
- **THEN** the result reports decision `install`, the current missing inspection, and `wouldChange: true`
- **AND** it does not execute a provider, acquire a write lock, write state, or synthesize an `after` inspection

#### Scenario: Consumer applies install to a managed agent

- **GIVEN** the requested agent is already present with matching live and recorded source evidence
- **WHEN** the consumer calls `install` or `ensure` in apply mode
- **THEN** the result reports decision `already-satisfied` and `changed: false`
- **AND** its `after` value is a fresh managed inspection rather than a cached or predicted result

#### Scenario: PATH-only agent is preserved

- **GIVEN** the executable is present on PATH but no supported live provider evidence proves Quantex ownership
- **WHEN** the public Core SDK is asked to install or ensure it
- **THEN** the result reports decision `external-preserved` without adopting or recording the executable
- **AND** no public option can weaken that ownership default

#### Scenario: Consumer inspects the public mutation result

- **WHEN** a downstream TypeScript consumer compiles against a mutation result
- **THEN** it cannot access provider drivers, recipes, plans, receipts, state documents, lock leases, or compensation callbacks
- **AND** preview and apply remain distinguishable without optional fields that permit a synthetic `after` value

### Requirement: Core SDK returns domain results without CLI presentation concerns

Core lifecycle methods MUST return serializable discriminated results and MUST NOT print, prompt, call `process.exit`, emit CLI output envelopes, or expose CLI exit-code policy. Inspection MUST distinguish missing, managed, external, stale, conflict, and indeterminate states without permitting contradictory ownership combinations.

#### Scenario: Expected lifecycle failure occurs

- **WHEN** Core cannot inspect or mutate an agent because of an expected lifecycle condition
- **THEN** it returns a typed error result with a stable machine-usable code and remediation detail
- **AND** it does not write human or structured CLI output to stdout or stderr

#### Scenario: Provider evidence is uncertain

- **WHEN** executable, provider, or recorded-source evidence is rejected, times out, conflicts, or is unknown
- **THEN** inspection returns an indeterminate or conflict result
- **AND** it does not report the agent as conclusively missing

#### Scenario: Mutation fails in one lifecycle phase

- **WHEN** Core cannot decide, execute, verify, record, or compensate an install
- **THEN** it returns a stable domain error code with machine-usable phase and side-effect details
- **AND** those details distinguish `none`, `compensated`, and `may-remain` without exposing the internal provider outcome shape

### Requirement: Core SDK keeps CLI and infrastructure internals private

The Core SDK public entry point MUST NOT export command handlers, presenters, mutable CLI context, raw provider drivers, recipes, lifecycle plans, receipts, state mutators, self-upgrade helpers, release-artifact helpers, or infrastructure ports.

#### Scenario: Consumer inspects the package exports

- **WHEN** a consumer inspects the packed Core package and declaration entry point
- **THEN** only the documented root API and package metadata subpath are exported
- **AND** CLI, provider, state, self-upgrade, and release internals cannot be imported through supported subpaths

#### Scenario: Core package dependency boundary is checked

- **WHEN** the Core bundle and declarations are validated
- **THEN** they contain no dependency on Commander, prompts, CLI presenters, CLI command modules, mutable CLI context, self-upgrade, or release-artifact code
- **AND** the read-only slice does not depend on mutation-capable provider adapters, package mutation helpers, or update cache/network modules

#### Scenario: Core observes the maintained catalog

- **WHEN** the read-only Core bundle is generated and built
- **THEN** it uses a deterministic catalog projection without mutation-only metadata
- **AND** its default provider registry exposes observation capabilities but no install, update, or uninstall operation

#### Scenario: A consumer imports the Core root without invoking a mutation

- **WHEN** a consumer imports the Core package or uses only `list` and `inspect`
- **THEN** mutation providers and process runners are not eagerly initialized
- **AND** every emitted mutation chunk remains subject to the same CLI, presentation, self-upgrade, release, and unsupported-subpath boundary checks

### Requirement: Core lifecycle mutations preserve evidence and verification safety

When mutating methods are introduced, Core MUST bind update and uninstall to a recorded and live-confirmed install source, treat external PATH-only agents as unmanaged by default, freshly verify every postcondition, and persist success evidence only after verification.

#### Scenario: PATH contains an untracked agent

- **GIVEN** an executable is present on PATH without live evidence that Quantex owns a supported global provider installation
- **WHEN** Core is asked to update or uninstall it
- **THEN** Core returns an external ownership result and performs no mutation

#### Scenario: Provider command exits successfully but verification fails

- **WHEN** a Core mutation process exits successfully
- **BUT** a fresh observation does not satisfy the expected postcondition
- **THEN** Core returns failure or indeterminate rather than success
- **AND** it does not persist a successful receipt or installed-agent state transition

#### Scenario: Ghost state is observed with uncertain provider evidence

- **GIVEN** recorded provenance exists but the provider probe is rejected, times out, or is unknown
- **WHEN** Core reconciles the agent
- **THEN** it retains the recorded provenance
- **AND** it does not clear the state as conclusively absent

#### Scenario: Ghost state is conclusively absent

- **GIVEN** recorded provenance exists and that exact provider target plus the executable are conclusively absent
- **WHEN** Core installs or ensures the agent
- **THEN** it selects only the exact recorded source and reports decision `reinstall`
- **AND** it does not choose a different provider merely because it appears earlier in the catalog

#### Scenario: Provider selection precedes side effects

- **WHEN** Core prepares a missing-agent install
- **THEN** it may reject unavailable candidates and choose one supported recipe before mutation begins
- **AND** after the selected provider install starts it never invokes another provider or the legacy engine for the same request

#### Scenario: Installed resource predates the invocation

- **GIVEN** the selected provider target was present before the current invocation
- **WHEN** verification or state recording later fails
- **THEN** Core does not uninstall or remove that pre-existing resource
- **AND** Bun trust recovery follows the same conclusive ownership rule

#### Scenario: Install effect cannot be safely reversed

- **GIVEN** a script or binary recipe starts a side effect that has no reliable uninstall operation
- **WHEN** later verification or recording fails
- **THEN** Core does not guess which files to delete
- **AND** the error reports `may-remain` with explicit manual remediation

### Requirement: Core invocation cancellation is sticky and cleanup precedes return

Core MUST treat cancellation and timeout as terminal invocation outcomes, terminate owned process trees, run registered cleanup before returning, and prevent late process success from recording or replacing the cancellation outcome.

#### Scenario: Mutation is cancelled while a child process is active

- **WHEN** an invocation signal aborts during a provider mutation
- **THEN** Core terminates the owned process tree and completes cleanup before resolving the call
- **AND** it writes no success state or receipt

#### Scenario: Cancelled process later reports success

- **WHEN** an interrupted process produces a late successful exit or callback
- **THEN** the returned result remains cancelled or timed out
- **AND** no later success overwrites that result

#### Scenario: Provider reports interruption without aborting the caller signal

- **WHEN** a provider returns a cancelled or timed-out typed outcome
- **THEN** Core marks the invocation interrupted and drains or forcibly runs every registered cleanup before return
- **AND** the caller does not need to abort its own signal to obtain the cleanup guarantee

#### Scenario: Core-owned runner acquires a resource

- **WHEN** a Core-owned port or process runner acquires an owned child process, temporary resource, or lock
- **THEN** it registers cleanup immediately after acquisition and before its next asynchronous boundary
- **AND** cancellation cannot race past registration and return while the owned resource remains live

#### Scenario: Cancellation races with verified state recording

- **WHEN** cancellation or timeout occurs while a verified installation is being recorded
- **THEN** Core waits for the in-flight atomic write and restores the invocation's pre-write schema-version-2 document before returning the interruption
- **AND** no late write can recreate successful installed state or a receipt after the invocation resolves

#### Scenario: Core uses an isolated configuration directory

- **WHEN** an apply invocation acquires lifecycle or state locks
- **THEN** lock paths are derived from that client's explicit resolved configuration directory
- **AND** the same explicit-root lock primitive is shared with the legacy compatibility wrapper rather than duplicated with weaker semantics

### Requirement: Core remains an agent lifecycle SDK rather than an orchestration platform

The Core SDK MUST NOT add update-all, workflow DAG, batch pipeline, stdin-apply, daemon, MCP server, remote plugin, or self-upgrade APIs as part of this change.

#### Scenario: Consumer reviews the public API

- **WHEN** a consumer reviews the stable Core entry point
- **THEN** it contains only single-agent lifecycle discovery, inspection, mutation, and execution capabilities that have completed their gates
- **AND** Quantex self-upgrade and workflow orchestration are absent
