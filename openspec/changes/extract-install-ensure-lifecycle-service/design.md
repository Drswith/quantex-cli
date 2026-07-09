## Context

The single-agent paths in `src/commands/install.ts` and `src/commands/ensure.ts` independently perform the same sequence:

1. resolve the catalog agent and inspect the current installation;
2. classify a managed, safely adoptable, or ambiguous existing installation;
3. handle dry-run behavior;
4. track an adopted installation or invoke `installAgent`;
5. translate cancellation and lifecycle lock failures;
6. construct command-specific structured output and render human output.

The duplication has already accumulated subtle differences, including the install command's pre-start cancellation check and different event-emission behavior. The project has active users, so this change must preserve those differences where they are part of the current contract rather than replacing both commands with a new public model.

## Goals / Non-Goals

**Goals:**

- Establish compatibility tests for the published single-agent install and ensure behavior.
- Move shared inspection, adoption, dry-run, tracking, installation, and lock classification into one focused service.
- Keep command-specific output, messages, events, batch aggregation, and rendering at the command boundary.
- Make the shared lifecycle flow directly testable without invoking the Commander CLI.
- Reduce the size and change surface of both command handlers without changing persisted state or public contracts.

**Non-Goals:**

- Changing command names, flags, aliases, schemas, warning or error codes, exit behavior, or human-facing semantics.
- Refactoring batch install aggregation.
- Replacing installer boolean results with richer adapter errors.
- Changing lifecycle lock scope or concurrency.
- Refactoring update, uninstall, exec, self-upgrade, catalog loading, configuration, or state formats.
- Introducing a generic desired-state planner or workflow engine.

## Decisions

### Use a command-neutral discriminated outcome from one shared service

Create `src/services/install-ensure.ts` with a single lifecycle operation that returns a discriminated outcome for the current states: agent not found, already managed, dry-run tracking, tracked existing install, ambiguous unmanaged install, dry-run install, installed, install failed, tracking cancelled, and resource locked.

The outcome contains the resolved agent and installed state only when those facts exist. It does not contain `CommandResult`, action names, warning text, human copy, exit codes, or NDJSON events.

This keeps the service reusable by both commands while preserving each command's existing result mapping.

**Alternatives considered:**

- Return `CommandResult` from a shared helper: rejected because it would move CLI action names and output contracts into the service instead of separating them.
- Make `ensureCommand` call `installCommand`: rejected because it would emit the wrong action, messages, events, and result metadata.
- Introduce a generic plan/apply engine now: rejected because it is too broad for the first compatibility-preserving slice.

### Keep command-specific preflight and event policy at the command boundary

`installCommand` keeps its current pre-start cancellation result before calling the shared service. Each command passes a mutation-start callback so the service can signal the point at which tracking or installation is about to mutate state, while the command remains responsible for emitting its current action-specific NDJSON event.

Dry-run and cancellation state are passed explicitly into the service operation rather than making result construction depend on output mode.

This preserves current differences without duplicating lifecycle decisions.

### Preserve package-manager and state behavior unchanged

The service continues to call the existing `resolveAgentInspection`, `getAdoptableExistingInstallMethod`, `trackInstalledAgent`, and `installAgent` functions. It does not alter install method ordering, fallback behavior, rollback, persisted state, or the global lifecycle lock.

Resource lock errors are classified by the service and returned with the original error so each command can construct the same `RESOURCE_LOCKED` details it emits today. Other unexpected errors continue to propagate.

### Treat existing command tests as compatibility tests and add focused service tests

Existing install and ensure command tests remain authoritative for public results and rendering. New service tests cover the shared decision matrix directly. Refactoring proceeds test-first: add a failing service test for one outcome, add the minimum service behavior, migrate one command branch, and keep both command suites green.

No snapshot of timestamps, run IDs, or other intentionally variable metadata is introduced. Compatibility assertions target stable action, target, data, warnings, errors, events, and exit behavior.

## Risks / Trade-offs

- **Risk: The service outcome duplicates some concepts from `CommandResult`.** → Keep it limited to lifecycle facts and do not add output messages, schema metadata, or rendering concerns.
- **Risk: Moving logic changes a warning, event, or cancellation edge case.** → Lock current behavior with command-level characterization tests before migrating each branch.
- **Risk: The first slice does not fix installer error opacity or global lock contention.** → Keep those explicitly out of scope; later changes can improve them after this shared boundary exists.
- **Risk: A mutation-start callback becomes an output backchannel.** → Define it as a zero-argument lifecycle hook and prohibit passing output objects into the service.
- **Trade-off: Commands retain result-mapping code.** → This is intentional because public compatibility belongs at the command boundary; later duplication can be reconsidered only with separate contract evidence.

## Migration Plan

1. Add missing command-level compatibility cases for stable install and ensure outcomes.
2. Add focused tests for the new service outcome matrix.
3. Implement the shared service around the existing inspection, adoption, tracking, and installation functions.
4. Migrate the single-agent install path to map service outcomes into the existing results.
5. Migrate ensure to map the same outcomes into its existing results.
6. Run focused tests, the complete suite, lint, format check, typecheck, and OpenSpec validation.

Rollback requires only restoring the command-local control flow and deleting the new service. There is no configuration, state, catalog, or data migration to reverse.

## Open Questions

None. Rich installer errors, per-agent locking, catalog decoupling, and additional lifecycle commands require separate future OpenSpec changes.
