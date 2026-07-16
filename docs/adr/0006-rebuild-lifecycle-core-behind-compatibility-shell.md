# ADR 0006: Rebuild the Lifecycle Core Behind a Compatibility Shell

- Status: Accepted
- Date: 2026-07-10

## Context

Quantex has a stable product boundary and a growing installed audience, but lifecycle behavior has accumulated across large command modules, separate command/schema registries, duplicated provider capability metadata, unversioned management state, and a process-global runtime context.

A purely internal cleanup would retain the command-centric model. A big-bang `v2` product would provide a clean implementation at the cost of breaking package, binary, structured-output, state, and automation compatibility.

## Decision

Quantex will rebuild its internal lifecycle core as a modular monolith behind an explicit compatibility shell.

- The new agent lifecycle model is observation, planning, execution, postcondition verification, and receipt persistence.
- CLI registration, discovery, schemas, effects, and presenters derive from one command-contract registry.
- Provider adapters expose typed operations and derive capabilities from the operations they implement.
- Persisted state is versioned, rebuildable management evidence that is reconciled with the live environment.
- Runtime context is per invocation rather than process-global.
- Package names, binary names, stable commands, v1 structured protocol, stream/exit behavior, config/state readability, and maintained root exports remain compatible during the redesign.
- Quantex self-upgrade remains a separate bounded context and shares only infrastructure-level ports.
- Delivery is incremental by command family; the project will not introduce a parallel `quantex-v2` product.

The detailed contract and migration sequence live in the active `redesign-lifecycle-engine` OpenSpec change.

## Consequences

- Internal implementation can change substantially without making those boundaries public contracts.
- Incremental migration may temporarily carry migration-only handlers; they are removed only after every default route and the compatibility gates verify the replacement engine.
- Compatibility must be tested as a first-class adapter rather than inferred from unchanged command names.
- State receipts and typed provider outcomes make drift, partial failure, and recovery more explicit.
- A future removal of root-package exports requires its own deprecation decision; it is not bundled into the engine rewrite.
- Remote catalogs, dynamic providers, daemons, and workflow orchestration remain outside the mainline design.

## Alternatives Considered

### Continue refactoring within the current command and service boundaries

Rejected because it can reduce file size but does not establish one lifecycle model or remove independent command/schema/provider sources of truth.

### Publish a breaking `quantex-v2` package or binary

Rejected because the existing command vocabulary is adequate and the compatibility cost would fall on users, aliases, automation, and local state rather than on the implementation.

### Model Quantex self-upgrade as another managed agent

Rejected because binary replacement, checksum verification, source detection, Windows delayed replacement, and rollback have materially different semantics. ADR 0002 remains in force.
