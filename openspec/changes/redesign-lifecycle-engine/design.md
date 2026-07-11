## Context

Quantex `v0.29.0` already covers the intended product loop: discover supported coding agents, inspect the local environment, install or adopt an agent, keep its real install source, update or uninstall it safely, launch it with transparent IO, and expose the same work through human and structured surfaces.

The current implementation is locally well tested but globally organized around command growth:

- CLI registration, the stable command catalog, output schemas, README examples, and exported TypeScript types are maintained independently.
- The live command catalog advertises 15 stable commands while the schema catalog contains 9, so six advertised schema references do not resolve.
- `install`, `ensure`, `update`, `uninstall`, and `run` each own substantial lifecycle control flow, rendering, error mapping, and state behavior.
- Provider identity and capability knowledge is repeated across union types, capability tables, adapter registries, update bucket ordering, discovery output, and schemas.
- Persisted state is sometimes treated as authority and sometimes as a hint, but the distinction is not represented in the data model.
- Agent update availability uses version inequality while self-upgrade already distinguishes a newer version from a stale lower version.
- The CLI uses process-global invocation context even though the package exports a broad programmatic surface.
- Accepted ADRs, current OpenSpec requirements, and implementation can drift when a later change does not explicitly supersede the older decision.

The redesign must account for a real installed audience. Both `quantex-cli` and the `quantex` alias publish the same `qtx` and `quantex` entry points, and the alias depends on `quantex-cli`. Download counts overlap and do not prove library API use, but they make an unannounced big-bang replacement unjustifiable.

The project constraints remain:

- one local-first CLI product rather than a workflow orchestration platform;
- Bun-based strict TypeScript with no required background service;
- transparent agent process IO;
- explicit, explainable mutation and network behavior;
- protected releases and incremental delivery through OpenSpec-backed changes;
- self-upgrade remains behaviorally separate from agent lifecycle.

## Goals / Non-Goals

**Goals:**

- Make lifecycle reconciliation, not individual command modules, the primary internal model.
- Give every mutation an explicit observation, plan, execution, postcondition verification, and persisted receipt.
- Generate CLI registration, discovery, schemas, help metadata, and compatibility projections from one command-contract registry.
- Make provider capabilities executable properties of typed adapters rather than duplicated metadata tables.
- Preserve the established v1 CLI and machine contract while replacing internal implementation incrementally.
- Make runtime calls re-entrant and independently testable through per-invocation context and explicit ports.
- Keep state migration reversible and resilient to temporary downgrade to an older Quantex binary.
- Organize tests around lifecycle invariants, provider conformance, protocol compatibility, and fault recovery.

**Non-Goals:**

- Do not introduce workflow DAGs, batch orchestration, stdin pipelines, a daemon, or an MCP server.
- Do not create a second `quantex-v2` product, parallel state home, or competing package name.
- Do not turn provider adapters into a dynamic third-party plugin or marketplace system.
- Do not model Quantex self-upgrade as a special agent definition.
- Do not make a remote catalog or runtime catalog refresh a prerequisite for the redesign.
- Do not preserve internal file layout, boolean provider APIs, command-module control flow, or process-global context.
- Do not remove existing root-package exports as part of the engine replacement; removals require a later explicit deprecation change.

## Decisions

### Decision: use a modular monolith behind a compatibility shell

Keep one package and one executable. Split the implementation into explicit domain, application, adapter, infrastructure, surface, and compatibility boundaries, but do not create separately versioned internal packages.

The outer compatibility shell continues to own package and binary names, argument parsing, v1 output projection, exit-code mapping, legacy state/config reading, and maintained root exports. The new core does not import or depend on v1 presenter shapes.

Why this over reorganizing the current modules in place:

- Moving functions between existing command, service, and package-manager folders would preserve the current command-centric model.
- A compatibility boundary permits the core model to become coherent without making each internal decision part of the public contract.

Why this over a new major product:

- A separate binary or state home would fragment the installed base and double documentation, release, and recovery paths.
- The current external command vocabulary is sufficient; the internal model is the part that needs replacement.

### Decision: model agent lifecycle as observe, plan, execute, verify, and record

Every lifecycle use case produces or consumes the following domain values:

- **Intent**: normalized user request, target, policy, and requested side effects.
- **Observation**: current executable presence, resolved path, installed version, provider evidence, recorded receipt, and any drift or uncertainty.
- **Plan**: ordered steps with declared effects, preconditions, expected postconditions, and optional compensation.
- **Step outcome**: typed success, unsupported, unavailable, absent, cancelled, timed out, locked, or failed result with diagnostics.
- **Verification**: a fresh observation evaluated against the plan postcondition.
- **Receipt**: verified management evidence persisted only after the postcondition succeeds.

Read-only commands may stop after observation. Dry-run commands stop after planning. Mutating commands MUST verify before recording success. Batch update is a deterministic composition of target plans, not a distinct orchestration platform.

The planner is pure after receiving an observation and provider capability snapshot. It does not print, spawn processes, read files, or perform network calls. The executor does not decide lifecycle policy.

Why this over a generic `UpgradableTarget` abstraction:

- Agent install/update/uninstall semantics and Quantex binary replacement have different safety and recovery requirements.
- Shared low-level execution primitives are useful; shared business semantics would blur the boundary already protected by ADR 0002.

### Decision: make command contracts the only command source of truth

Each command definition records:

- canonical name, aliases, arguments, and options;
- input normalization and validation;
- interaction, process, filesystem, mutation, and network effects;
- result and event schemas;
- stable error and exit mappings;
- human renderer and structured presenter adapters;
- use-case handler.

CLI registration, `commands`, `schema`, generated help metadata, contract tests, and generated documentation fragments consume this registry. CI asserts that every advertised schema reference resolves and every registered stable command appears exactly once.

The v1 compatibility presenter omits newly modeled metadata that is not allowed by the current strict schemas. Richer fields such as declared effects require explicit protocol-version negotiation in a later change; they are not silently added to schema version 1.

Why this over keeping separate snapshots:

- Separate snapshots can prove each list is stable while still permitting the lists to disagree.
- Generated projections make disagreement structurally impossible and reduce catalog/docs synchronization work.

### Decision: use typed provider adapters with capabilities derived from operations

A provider adapter owns a stable identifier and implements only supported operations:

- availability and environment diagnostics;
- package/executable observation;
- optional latest-version resolution;
- optional install, update, and uninstall execution;
- provider-specific verification evidence.

Capabilities are derived from these operations. The registry remains compile-time and first-party. There is no dynamic loading API in this design.

Provider calls return typed outcomes rather than booleans. Failures preserve the provider command, exit status when available, retryability, cancellation state, and safe remediation detail without leaking arbitrary stack traces into the stable protocol.

Why this over the current full interface plus a separate capability table:

- Required no-op methods and duplicated capability flags can disagree.
- Typed absence of an operation is a stronger and simpler capability declaration.

### Decision: keep catalog data declarative and bind package identity once

An install candidate contains its provider, provider target identity, supported platforms, priority, executable name overrides, and operation arguments in one record. Agent-level package maps no longer duplicate candidate package names.

Version probes use a bounded set of declarative parsers such as semantic-version token, regular expression capture, or JSON field extraction. Direct argv execution is preferred. Shell-script installation remains an explicit candidate kind with visible command/source metadata because several upstream agents only publish shell or PowerShell installers.

Catalog validation and generated support documentation consume the same normalized model. The catalog remains bundled with Quantex for this redesign.

### Decision: treat persisted state as versioned, rebuildable evidence

The live environment is authoritative. Persisted records answer what Quantex previously managed and how; they do not override contradictory provider or PATH evidence.

State adds a schema version and lifecycle receipts while retaining the legacy `installedAgents` and `self` projection during the compatibility window. A receipt records provider identity, target identity, observed executable, verification time, and the minimum provider-specific evidence needed to plan a later update or uninstall.

Observation classifies the relationship between receipt and live state:

- verified and consistent;
- present but untracked;
- recorded but absent;
- conflicting source evidence;
- indeterminate because a provider probe failed.

Migrations remain atomic and fail closed. A pre-migration backup is retained until the new state has been read and verified. If an older Quantex version rewrites only the legacy projection, the new engine can rebuild missing receipts from the live environment rather than treating receipt loss as installed-agent loss.

Config remains at `~/.quantex/config.json`; this redesign does not introduce another configuration format.

### Decision: bind idempotency to request meaning and postconditions

The caller-supplied key remains part of the public CLI. The stored record additionally contains:

- a canonical fingerprint of action, normalized targets, and mutation-relevant options;
- the resolved plan identity when a request such as `latest` depends on observation;
- the verified postcondition and target receipt fingerprint;
- record schema version and expiry.

Replay occurs only when the supplied key maps to the same request fingerprint and the command-specific replay validator confirms the postcondition still holds. Dry runs and failures remain non-replayable. A request mismatch returns a stable invalid-argument result rather than silently reusing or overwriting the record.

### Decision: replace process-global runtime state with per-invocation context

Each CLI or library invocation owns a context containing cancellation, timeout, output policy, cache policy, clock, process runner, filesystem/network ports, stores, catalog, and provider registry. Context is passed through use cases and infrastructure rather than read from a mutable singleton.

The CLI entry point may still create one context per process, but the core and maintained programmatic facade become re-entrant. Cancellation handlers belong to the invocation and cannot cancel unrelated concurrent calls.

### Decision: keep one canonical result/event model and explicit presenters

The core returns typed results and ordered lifecycle events without writing to stdout or stderr. Human, JSON v1, and NDJSON v1 presenters consume those values.

Compatibility requirements include:

- structured stdout remains parseable and free of installer logs;
- human diagnostics and child installer output remain on the appropriate terminal stream;
- transparent agent execution continues to inherit stdio and return the agent exit code;
- existing stable error codes and exit mappings remain unless a separate OpenSpec change explicitly revises them;
- batch partial success remains represented rather than collapsed into a boolean.

New internal events may be projected into the existing v1 started/progress/cancelled/result vocabulary. A future protocol version can expose richer phases and sequence numbers only through explicit negotiation.

### Decision: keep self-upgrade separate and make command effects explicit

Self-upgrade continues to own install-source detection, registry resolution, binary asset selection, checksum verification, replacement, rollback, and source-specific recovery. It may share process, network, locking, state, and presentation infrastructure with agent lifecycle.

Ordinary commands do not cause an implicit self-upgrade network request. A passive human notice may consume metadata already present in a valid cache; `upgrade --check`, `upgrade`, and explicitly network-aware diagnostics own fresh checks.

This reconciles the current implementation with the explicit-invocation decision in ADR 0003 without removing useful cached notices.

### Decision: separate architectural acceptance from command migration

This OpenSpec change is the umbrella contract for the redesign, but delivery is milestone-based. Each milestone must leave the default CLI releasable and can use a narrow implementation PR. The active change remains unarchived until all accepted requirements are implemented and current specs are synchronized.

Implementation planning must produce dependency-ordered milestone plans rather than one giant patch. The first implementation plan covers the compatibility baseline and foundation only; later command-family migrations receive their own plan and review checkpoint. No milestone may combine unrelated product expansion with engine migration.

While the active delivery change `support-integration-branch-delivery` exists, every redesign milestone follows `docs/runbooks/lifecycle-integration-delivery.md`: branch from the latest protected `codex/redesign-lifecycle-integration`, deliver one independently planned and reviewed commit through a pull request to that branch, and keep both changes active. The complete integration branch is promoted to `main` only after the unchanged 74-task denominator is genuinely complete and the final compatibility and release-readiness gates pass. Actual current-spec synchronization and archive execution remain post-promotion work owned by the delivery change.

## Target Boundaries

The exact file names may change during implementation, but the dependency direction is fixed:

1. **Domain** owns intents, observations, plans, outcomes, postconditions, receipts, and errors. It depends on no CLI or infrastructure module.
2. **Application** owns use cases and coordinates observer, planner, executor, verifier, and stores through ports.
3. **Providers** implement external package-manager and installer behavior against application ports.
4. **Infrastructure** implements process, filesystem, network, clock, locking, and persistence ports.
5. **Surface** owns command definitions, parsing, and presenters.
6. **Compatibility** maps current CLI/state/library contracts onto the new surface and application APIs.
7. **Self lifecycle** is a sibling bounded context that shares infrastructure but not agent domain types.

Dependencies point inward. Domain and application code MUST NOT import Commander, console renderers, legacy output envelopes, or concrete provider modules.

## Compatibility Matrix

| Surface | Policy during redesign |
|---|---|
| npm packages `quantex-cli` and `quantex` | Preserve |
| binaries `qtx` and `quantex` | Preserve |
| stable command names and aliases | Preserve |
| documented global flags and non-interactive behavior | Preserve |
| JSON/NDJSON v1 envelope and schema version | Preserve by presenter fixtures |
| stable error codes and exit-code mapping | Preserve unless separately specified |
| stdout/stderr separation | Preserve |
| agent stdio and exit-code passthrough | Preserve |
| `~/.quantex/config.json` and `state.json` readability | Preserve with atomic migration |
| recorded install-source preference | Preserve and strengthen through receipts |
| maintained root-package exports | Preserve through facade in this change |
| exact human wording, colors, and internal ordering | Not guaranteed unless documented |
| source file paths and internal functions | No compatibility requirement |
| command/schema inconsistencies and implicit downgrade behavior | Treat as defects, not compatibility |

### Compatibility fixture policy

Compatibility fixtures treat package and binary names, machine-readable field names, types, requiredness, and semantics, stable error codes and exit mappings, command names and schema references, v1 state interpretation, and maintained root-package exports as hard contracts. A fixture that changes one of these values requires an intentional compatibility review and the corresponding specification change; internal replacement alone does not authorize updating the golden value.

ANSI styling, whitespace, timing, host-dependent capability or network values, and free-form human diagnostic prose are intentionally non-contractual. Tests may make focused assertions about such output when a documented behavior requires it, but these details do not become compatibility contracts unless a later specification explicitly promotes them.

## Testing Strategy

- **Protocol golden tests** capture representative v1 JSON, NDJSON, exit codes, and stream routing from `v0.29.0` before command migration.
- **Registry invariants** prove CLI registration, command discovery, schema discovery, and documented stable commands are generated from the same definitions.
- **Pure planner tables** cover tracked, untracked, missing, drifted, unsupported, stale-latest, and cancellation cases without process mocks.
- **Provider conformance suites** run the same availability, typed outcome, cancellation, and verification expectations against every provider adapter.
- **State migration and fault injection** cover invalid legacy state, interrupted writes, backup restore, older-version projection loss, and receipt rebuilding.
- **Idempotency contract tests** cover request mismatch, stale postconditions, latest-target changes, batch targets, dry run, failure, and expiry.
- **Compatibility compilation tests** cover maintained root exports and the `quantex` alias facade.
- **Container and remote sandbox smoke tests** continue to prove real lifecycle behavior without relying only on mocks.
- **Self-upgrade fault tests** retain checksum, lock, platform replacement, Windows peer entry point, and rollback coverage.

## Risks / Trade-offs

- [A compatibility shell becomes permanent accidental complexity] -> Keep it as a one-way adapter, prohibit new domain dependencies on v1 types, and track every compatibility branch with tests and an owner.
- [Dual implementations disagree during migration] -> Use shadow planning and golden comparisons before routing mutations to the new executor; keep routing changes narrow and reversible.
- [A long-lived umbrella change becomes hard to review] -> Deliver dependency-ordered milestones with explicit closure status and no unrelated features; keep the design/spec change as the common contract.
- [State migration prevents downgrade] -> Retain the legacy projection and a verified backup, make receipts rebuildable, and avoid new provider identifiers that old readers cannot normalize during the compatibility window.
- [Provider abstraction hides necessary differences] -> Keep provider-specific evidence and typed failure details; standardize lifecycle outcomes, not command syntax.
- [Generated command metadata limits exceptional UX] -> Permit explicit presenter hooks in a command definition while keeping registration and schemas generated.
- [Root exports freeze too much internal API] -> Preserve them through facade for this change, gather known consumers, and require a later deprecation proposal for removal.
- [No remote catalog means upstream metadata can still become stale] -> Keep explicit CLI releases as the trusted update path; evaluate signed catalog refresh separately only if release cadence becomes the dominant problem.
- [Cached passive notice becomes stale] -> Require normal cache freshness metadata and never turn a cache miss into an ordinary-command network request.

## Migration Plan

### Phase 0: contract baseline

1. Capture compatibility fixtures from the current release for every stable command family.
2. Add failing invariants for command/schema completeness, semantic no-downgrade behavior, and ordinary-command network effects.
3. Record the maintained root exports and legacy state/config fixtures.

Rollback: no production routing changes occur in this phase.

### Phase 1: foundation

1. Introduce domain values, per-invocation context, ports, typed outcomes, provider registry, and command-contract definitions behind existing entry points.
2. Keep current commands as compatibility handlers while generated registration/discovery/schema projections reach parity.
3. Add provider conformance and planner unit suites.

Rollback: revert individual adapter routing while retaining compatibility fixtures.

### Phase 2: observation and read-only surfaces

1. Migrate catalog normalization and live observation.
2. Route `list`, `info`, `inspect`, `resolve`, `capabilities`, and `doctor` through the new application boundary.
3. Compare structured and human behavior against v1 fixtures.

Rollback: route each command back to its legacy handler; no new state is required.

### Phase 3: core mutations

1. Introduce versioned receipts and legacy state projection.
2. Shadow-plan existing mutations without executing the new plan.
3. Migrate `ensure`, `install`, and `uninstall`, requiring postcondition verification before receipt updates.

Rollback: restore legacy command routing and read the preserved legacy projection/backup.

### Phase 4: update and execution

1. Migrate single-agent and batch update with semantic comparison, source-aware planning, typed partial results, and no implicit downgrade.
2. Migrate idempotency records and replay validators.
3. Migrate explicit `exec` and shortcut execution while preserving transparent IO, exit codes, timeout, and cancellation.

Rollback: preserve the old handlers until all compatibility and sandbox suites pass on the new route.

### Phase 5: self-upgrade integration

1. Move self-upgrade onto shared infrastructure without importing agent lifecycle domain types.
2. Make passive notices cache-only and preserve explicit check/upgrade behavior.
3. Re-run release artifact, binary replacement, recovery, and Windows delayed-swap suites.

Rollback: self-upgrade remains on its legacy bounded context until its replacement passes all fault tests.

### Phase 6: legacy-core removal

1. Remove command-specific lifecycle implementations only after every default route uses the new engine.
2. Keep v1 presenters, state projection, package/binary aliases, and root export facade.
3. Synchronize accepted delta specs, mark superseded project memory explicitly, and archive the OpenSpec change after merge.

Rollback: use the last release before legacy removal; state remains readable through the retained projection and backup.

## Open Questions

No architectural question blocks implementation planning. The implementation plan must still choose milestone/PR sizes and identify known private root-API consumers before proposing any future export removal; neither decision changes the architecture above.
