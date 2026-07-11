## Why

Quantex has the right product boundary, but its lifecycle behavior, command discovery, schemas, provider capabilities, state semantics, and compatibility surface have grown through several independent registries and command-specific control flows. The project now needs a coherent lifecycle core that can evolve without breaking the established CLI and machine-readable contracts used by a growing npm audience.

## What Changes

- Rebuild the internal agent lifecycle model around explicit observation, planning, execution, verification, and receipt persistence stages.
- Define command metadata, inputs, effects, result schemas, help, and discovery from one command-contract registry.
- Replace boolean-oriented package-manager orchestration with capability-driven provider adapters and typed operation outcomes.
- Treat persisted agent state as versioned management evidence that must be reconciled with the live environment rather than as unconditional truth.
- Preserve the existing package names, binary names, stable command names and aliases, structured envelope, error/exit semantics, transparent agent execution, and readable configuration/state during migration.
- Keep Quantex self-upgrade as a separate bounded context that shares infrastructure but is not modeled as another agent.
- Deliver the redesign incrementally behind a compatibility shell rather than through a big-bang replacement or a parallel `v2` product.
- **BREAKING**: Internal module boundaries, boolean provider APIs, and global runtime context may be replaced. Existing root-package exports remain available through a compatibility facade in this change even when their backing implementation is replaced; removal requires a later explicit deprecation change.

## Capabilities

### New Capabilities

- `lifecycle-reconciliation`: Defines the observe-plan-execute-verify-record lifecycle engine, typed outcomes, postcondition verification, and execution boundaries.
- `cli-contract-registry`: Defines a single source of truth for CLI registration, discovery, schemas, effects, and output presentation.
- `compatibility-contract`: Defines the external v1 surfaces that remain stable while the internal engine is replaced and the policy for deprecated library exports.

### Modified Capabilities

- `agent-catalog`: Installation candidates and probes become provider-bound declarative data without duplicated package identity.
- `agent-update`: Update planning uses verified source-aware observations and MUST NOT infer an update merely from version inequality or silently downgrade an agent.
- `agent-uninstall`: Uninstall behavior reconciles recorded receipts with live provider evidence before execution and result reporting.
- `cli-idempotency`: Replay is keyed by a canonical request fingerprint and remains valid only while the recorded postcondition still holds.
- `quantex-state`: Persisted state becomes schema-versioned, migration-safe lifecycle evidence with explicit drift handling.
- `self-upgrade`: Self-upgrade remains separate from agent lifecycle and ordinary commands do not introduce implicit network checks.

## Impact

- Affected architecture: CLI surface, command runtime, command modules, inspection, planning, services, package-manager adapters, state, idempotency, output, self-upgrade integration, and public exports.
- Affected contracts: `commands --json`, `schema --json`, structured result/event envelopes, exit codes, state/config compatibility, agent execution passthrough, and root-package API deprecation policy.
- Affected project memory: OpenSpec lifecycle/state/update/catalog contracts and a durable ADR for the compatibility-shell architecture.
- Expected implementation style: modular monolith in the existing package, incremental command migration with compatibility fixtures and shadow planning, no workflow orchestration platform and no dynamic provider marketplace.
- No new runtime dependency is required by the architecture decision itself.
