## Context

Supported agents are currently defined as one TypeScript module per agent under `src/agents/definitions/`. The shape is small and lifecycle-focused, but the catalog is not independently representable as JSON data and cannot be validated with a runtime schema before Quantex exposes it through CLI commands.

## Goals / Non-Goals

**Goals:**

- Make pure catalog metadata live in JSON-compatible data.
- Validate catalog data with Zod at module load before building runtime `AgentDefinition` values.
- Generate a checked-in JSON Schema from the same Zod contract.
- Preserve the existing public TypeScript exports for individual agent definitions.
- Keep future executable extensions in TypeScript rather than encoding behavior in JSON.

**Non-Goals:**

- Do not introduce remote or dynamic catalog fetching.
- Do not change install, update, version-probe, or command-output behavior unless validation exposes invalid data.
- Do not add workflow orchestration behavior.

## Decisions

- Use Zod as the canonical runtime contract and generate JSON Schema from it. This keeps validation executable in the CLI while still giving downstream tooling a machine-readable schema.
- Store serializable agent metadata in `catalog-data.json`. Thin TypeScript definition modules remain only as compatibility exports for existing imports and tests.
- Build runtime `AgentDefinition` objects through a catalog adapter. The adapter is the explicit boundary where future TypeScript-only behavior, such as parser functions, can be attached without hiding executable code in JSON.
- Keep JSON Schema checked in. A test compares the checked-in file with the generated schema so drift is caught locally and in CI.

## Risks / Trade-offs

- Data migration can accidentally change catalog ordering or optional-field presence -> preserve the current registry order and assert CLI lookups against the migrated objects.
- JSON Schema drift can silently mislead consumers -> add a regression test that compares the checked-in schema with generated output.
- Future agents may need non-serializable behavior -> keep behavior extensions in TypeScript and only allow JSON data to describe serializable lifecycle metadata.

## Migration Plan

1. Generate `catalog-data.json` from the current TypeScript definitions.
2. Add the Zod schema, JSON Schema emission, and catalog adapter.
3. Replace per-agent definition modules with thin exports backed by the validated catalog.
4. Update tests to cover valid and invalid catalog entries plus JSON Schema drift.
5. Update durable docs/specs to point supported-agent data at the new catalog contract.
