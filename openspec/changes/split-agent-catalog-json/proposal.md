## Why

The supported-agent catalog is now schema-backed, but all agent entries still live in one large JSON file. Splitting the catalog into one JSON file per agent makes reviews, merge conflicts, and future agent additions smaller while preserving the validated catalog contract.

## What Changes

- Move supported-agent data into `src/agents/catalog/*.json`, with that directory containing only agent JSON entries.
- Add a generated TypeScript manifest outside the catalog data directory so bundlers keep static JSON imports and deterministic ordering.
- Add a manifest generation script using Node filesystem APIs, not an additional glob dependency.
- Remove the old `src/agents/definitions/*.ts` compatibility layer and keep named agent exports from the validated catalog adapter.
- Preserve catalog metadata and structured validation while making catalog output order follow catalog filenames.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: supported-agent catalog data is maintained as one JSON file per agent with a checked-in generated manifest.

## Impact

- Affected code: `src/agents/`, `scripts/write-agent-catalog-manifest.ts`, tests, package scripts.
- Affected docs/specs: `openspec/specs/agent-catalog/spec.md`, `docs/agent-support-matrix.md`.
- No new dependency is expected.
