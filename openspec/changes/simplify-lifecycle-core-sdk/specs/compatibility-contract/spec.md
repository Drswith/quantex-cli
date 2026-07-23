## ADDED Requirements

### Requirement: Lifecycle simplification preserves historical safety invariants

The Core migration MUST preserve fail-closed provider observation, exact install-source ownership, postcondition verification, conclusive-only ghost cleanup, scoped compensation, atomic state, cancellation and timeout cleanup, no-downgrade update semantics, and platform-specific execution behavior before any legacy implementation is removed.

#### Scenario: Legacy implementation is proposed for deletion

- **WHEN** a migrated lifecycle path is proposed for deletion from the legacy engine
- **THEN** equivalent Core contract tests cover its success, failure, absent, unknown, conflict, cancellation, timeout, verification, state, receipt, and compensation behavior
- **AND** the deletion does not rely on removing old tests or refreshing compatibility fixtures without explicit contract review

#### Scenario: Provider observation cannot prove absence

- **WHEN** a provider probe is unsupported, rejected, timed out, cancelled, or returns unknown evidence
- **THEN** both legacy and Core compatibility projections treat the lifecycle state as indeterminate rather than absent
- **AND** neither path erases recorded source evidence

### Requirement: State remains bidirectionally compatible throughout 1.x

Every 1.x release in this migration MUST continue reading and writing the existing state schema version 2 and current installed-agent, receipt, self, and idempotency projections without adding persisted fields that the preceding supported release rejects or discards unsafely.

#### Scenario: Previous release writes state before upgrade

- **GIVEN** the immediately preceding released CLI writes valid state and idempotency records
- **WHEN** the new release reads and mutates that installation
- **THEN** it preserves the recorded identities and meanings without a destructive migration

#### Scenario: User temporarily downgrades after a new release mutation

- **GIVEN** the new release has completed a lifecycle mutation and written state
- **WHEN** the immediately preceding released CLI reads and safely mutates that state
- **AND** the user returns to the new release
- **THEN** both releases preserve valid provenance and the new release can reconcile the resulting live state

#### Scenario: State document is corrupt

- **WHEN** either compatibility path encounters a corrupt or unsupported state document
- **THEN** it fails closed and preserves recoverable data
- **AND** it does not replace the document with an empty state as a mutation side effect

### Requirement: Engine routing is fixed before lifecycle side effects

During compatibility transition, Quantex MUST select legacy or Core once before each lifecycle invocation and MUST NOT automatically fall back to the other engine after the selected engine begins any side effect.

#### Scenario: Selected engine fails before any side effect

- **WHEN** an invocation cannot initialize its selected engine before a side effect begins
- **THEN** Quantex MAY return a stable failure or use an explicitly configured whole-invocation route according to the current release policy
- **AND** the route decision is observable in diagnostics

#### Scenario: Selected engine fails after mutation begins

- **WHEN** the selected engine has started a provider, filesystem, or state side effect and then fails
- **THEN** Quantex MUST complete that engine's verification or scoped recovery path
- **AND** it MUST NOT invoke the other engine for the same request

### Requirement: Core promotion uses differential and first-party conformance gates

Before a lifecycle family becomes Core-default, test-only comparison MUST cover legacy and Core observation, decision, typed outcome, state delta, receipt, and v1 CLI projection, and every first-party provider driver involved in that family MUST pass a common typed-outcome and interruption conformance suite.

#### Scenario: Core lifecycle family is promoted

- **WHEN** maintainers propose making one lifecycle family use Core by default
- **THEN** its differential fixtures match for every maintained v1 contract
- **AND** relevant first-party providers pass observation, successful mutation, failure, absent, unknown, cancellation, timeout, satisfied and unsatisfied verification, and scoped-compensation conformance

#### Scenario: Differential comparison is run for a mutation

- **WHEN** tests compare legacy and Core mutation behavior
- **THEN** they execute against isolated fixtures or captured effects
- **AND** production code does not shadow-run both mutating engines

#### Scenario: Install and ensure are enabled only for explicit Core routing

- **WHEN** 1.3 exposes beta or explicit whole-invocation Core routing for install or ensure
- **THEN** isolated differential fixtures compare decision, typed outcome, state delta, receipt, and maintained v1 human, JSON, NDJSON, exit, and stream projections
- **AND** stable CLI routing remains legacy until the full promotion matrix passes

#### Scenario: Public SDK and v1 adoption policy differ during transition

- **GIVEN** the public SDK preserves PATH-only agents as external by default
- **WHEN** the v1 compatibility adapter must retain an existing safe-adoption contract
- **THEN** any temporary adoption policy remains private to the compatibility adapter
- **AND** it is selected before the invocation and is not exposed as a public SDK option

#### Scenario: Released N/N-1 compatibility fixtures run in CI

- **WHEN** state and idempotency downgrade compatibility is validated
- **THEN** the fixtures are pinned to immutable released source identities or committed release artifacts
- **AND** the ordinary test suite does not depend on network access, registry availability, mutable tags, or a non-shallow Git history

#### Scenario: Maintained read commands route through Core

- **WHEN** list, info, inspect, resolve, or doctor begins consuming the Core read implementation by default
- **THEN** test-only differential fixtures compare complete resolved observations for managed, alias, external, missing, stale, conflict, indeterminate, and provider-timeout cases
- **AND** corrupt and future state documents fail closed in the same error domain
- **AND** maintained human, JSON, NDJSON, exit, and stream fixtures remain unchanged

### Requirement: Compatibility removal requires four stable minors and time soak

Quantex MUST retain the maintained v1 CLI, structured-output, state, standard-I/O, binary, and root-export contracts through at least the 1.2, 1.3, 1.4, and 1.5 stable minor stages described by this change. Breaking removal MUST wait for a later major, Core-default operation across at least two stable minors, at least 90 days after stable-default enablement, and a separately approved deprecation change; the later gate controls.

#### Scenario: Core read-only SDK is introduced in 1.2

- **WHEN** the first stable Core SDK is released
- **THEN** existing v1 surfaces remain supported and unchanged
- **AND** CLI mutations continue using the established default path

#### Scenario: Core becomes the stable default in 1.4

- **WHEN** all platform, provider, package, sandbox, fault, and downgrade promotion gates pass
- **THEN** Core MAY become the stable default
- **AND** legacy remains a pre-invocation rollback route through the following stable minor

#### Scenario: Removal is proposed before all gates expire

- **WHEN** a maintained compatibility surface is proposed for removal before 1.5 has shipped, before two Core-default stable minors, before 90 days have elapsed, or without a separate deprecation change
- **THEN** the removal MUST be rejected

### Requirement: Integration promotion includes real cross-platform gates

The lifecycle integration branch and every Core-default promotion SHALL run Linux, macOS, and Windows validation plus package and sandbox tests appropriate to the changed lifecycle family. Windows process-tree, command-shim, and delayed-replacement behavior MUST be a promotion gate rather than a Linux-only inference.

#### Scenario: Integration branch proposes a Core routing change

- **WHEN** a Core routing change is pushed or proposed for promotion
- **THEN** repository CI includes the integration branch and runs the required platform matrix
- **AND** a skipped Windows PR job cannot by itself satisfy the promotion gate

#### Scenario: Windows behavior is promoted

- **WHEN** a lifecycle or self-binary path that touches Windows execution is proposed for stable default
- **THEN** Windows smoke coverage proves command-shim argv safety, process-tree termination, and applicable delayed replacement or rollback behavior

#### Scenario: Windows process-tree helper stalls

- **WHEN** the Windows tree-termination helper does not exit before its cleanup deadline
- **THEN** Quantex terminates the helper and falls back to bounded direct termination of the owned child
- **AND** cleanup does not wait indefinitely or reuse a completed graceful-cleanup promise as force cleanup
