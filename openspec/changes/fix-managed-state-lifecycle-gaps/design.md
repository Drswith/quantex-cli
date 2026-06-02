## Context

Recent state hardening made corrupt `state.json` fail closed, but managed lifecycle still assumes every managed record includes a non-empty `packageName`. Legacy records may omit the field, and failed persistence after install can leave packages installed without durable tracking.

## Goals / Non-Goals

**Goals:**

- Keep recorded managed install sources authoritative during update.
- Infer missing managed `packageName` values only from the agent catalog for lifecycle execution.
- Prevent self-update fallback when a recorded managed source cannot run.
- Roll back managed installs when state write fails immediately after install.

**Non-Goals:**

- Full two-phase commit across all installer types (script/binary rollback stays best-effort).
- Migrating legacy state files automatically on read.

## Decisions

1. **Catalog inference at execution time** — `executeInstalledState` accepts the agent definition and resolves `packageName` via existing `getManagedPackageName` when the recorded value is missing. Empty strings remain invalid and fail on read.
2. **Self-update guard** — `updateAgent` only allows `executeAgentUpdateCommand` when there is no recorded managed source, or when a resolvable managed package name was available for the recorded managed attempt.
3. **Install rollback** — On `persistInstalledState` failure after a successful managed install, call the matching managed uninstall before surfacing the state error.

## Risks / Trade-offs

- Legacy records without `packageName` continue to load; inference may pick a different package than the original install if catalog metadata changed. This is preferable to self-update misrouting or silent failure.
