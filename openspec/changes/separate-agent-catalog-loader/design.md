## Context

The generated `catalog-data.ts` snapshot imports every checked-in JSON entry. `catalog.ts` immediately parses that singleton, materializes runtime definitions, builds a name index, and exposes lookup functions. Parsing and materialization cannot currently be exercised independently from the repository snapshot.

## Goals / Non-Goals

**Goals:**

- Separate catalog data loading from current-snapshot ownership.
- Keep schema validation and behavior-extension merging directly testable.
- Preserve runtime definitions, ordering, named exports, and object identity.

**Non-Goals:**

- Loading external or user-provided catalogs at runtime.
- Adding dynamic plugins, remote catalogs, hot reload, or mutable registry behavior.
- Changing catalog JSON, schema, generated manifests, or agent metadata.

## Decisions

### Introduce a synchronous pure loader

Add `loadAgentCatalog(data, behaviorExtensions?)`, which parses unknown input with the existing Zod schema, maps entries to `AgentDefinition`, and returns ordered agents plus canonical-name lookup. It performs no filesystem or generated-module access.

### Keep the generated snapshot as the production adapter

`catalog.ts` imports `catalogData`, calls the loader once, and preserves `getCatalogAgents` and `getCatalogAgent`. Generated named exports continue to resolve through that adapter, so callers and object identity remain unchanged.

### Keep behavior extensions explicit

The loader accepts an optional extension map for runtime-only functions such as custom version parsers. The production adapter passes the current empty extension set. This removes hidden module state without changing catalog data.

## Risks / Trade-offs

- **Risk: Loader copies change object identity or order.** → Retain one loaded snapshot instance and assert named exports reference the same objects.
- **Risk: Validation behavior drifts.** → Reuse the existing `agentCatalogSchema` and add direct invalid-input coverage.
- **Trade-off: The loader is exported internally but not exposed as a CLI feature.** → Keep it under `src/agents` and do not add external catalog discovery.

## Migration Plan

1. Run the existing catalog compatibility suite.
2. Add failing direct loader tests.
3. Implement the loader and migrate `catalog.ts` to a single loaded snapshot.
4. Run focused and full repository validation, including generated manifest checks.

Rollback moves the small loader functions back into `catalog.ts`; no data migration is involved.

## Open Questions

None.
