## Context

The uninstall command performs one command-neutral lifecycle sequence before mapping results: resolve the agent, require recorded managed state, honor dry-run, invoke the existing package-manager uninstall operation, and classify lifecycle lock errors. This is the same boundary already adopted for install and ensure.

## Goals / Non-Goals

**Goals:**

- Move uninstall lifecycle decisions into a focused, directly testable service.
- Preserve all published uninstall behavior and persisted-state semantics.
- Leave command-specific messages and rendering in the command.

**Non-Goals:**

- Changing which installs Quantex may uninstall.
- Changing package-manager adapter results, lock scope, state format, or command output.
- Combining uninstall with install/ensure outcomes or a generic desired-state engine.

## Decisions

### Return a command-neutral discriminated outcome

Create `runUninstallLifecycle(agentName, options, dependencies)` with outcomes for unknown agent, unmanaged install, dry-run plan, success, failure, and resource lock. The service returns resolved agent facts and the original lock error where needed, but never creates a `CommandResult` or message.

### Preserve current package-manager ownership

The service delegates to existing `resolveAgent`, `getInstalledAgentState`, and `uninstallAgent` functions. State removal, absence probes, and rollback semantics remain owned by `uninstallAgent`.

### Pass dry-run explicitly

The command reads CLI context and passes `dryRun`; the service does not read output mode or render events. This keeps the service testable while preserving the public dry-run result.

## Risks / Trade-offs

- **Risk: Mapping drift changes unmanaged details or lock data.** → Strengthen command-level structured assertions before migration.
- **Risk: Another small service increases module count.** → Keep it limited to the exact uninstall lifecycle sequence and avoid generic abstractions.
- **Trade-off: Installer errors remain boolean.** → Rich adapter errors remain a later, separately specified concern.

## Migration Plan

1. Add compatibility assertions to the existing uninstall command tests.
2. Add failing direct tests for every service outcome.
3. Implement the service with injectable default dependencies.
4. Replace command-local lifecycle branches with outcome mapping.
5. Run focused and full repository validation.

Rollback deletes the service and restores command-local control flow; no data migration is involved.

## Open Questions

None.
