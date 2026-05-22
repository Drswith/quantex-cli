## Why

Issue #240 is an OpenSpec-required catalog contract change because it affects supported-agent metadata, machine-readable schemas, and runtime validation. Quantex currently keeps each supported agent as a TypeScript object, which gives compile-time checks but makes the catalog harder to validate as stable JSON-compatible data.

## What Changes

- Add a maintained JSON-compatible supported-agent catalog data source.
- Add a Zod runtime schema that validates catalog data before CLI behavior consumes it.
- Emit and check in a JSON Schema generated from the same Zod contract.
- Keep executable behavior, such as custom parsers, in TypeScript behind an explicit extension boundary.
- Preserve existing agent lookup, list, install, check, update, and structured output behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: supported-agent entries become a validated JSON-compatible catalog contract with an emitted JSON Schema while preserving lifecycle-CLI behavior.

## Impact

- Affected code: `src/agents/`, agent registry tests, schema generation scripts, package dependencies.
- Affected docs/specs: `openspec/specs/agent-catalog/spec.md`, `docs/agent-support-matrix.md`.
- New dependency: direct runtime dependency on `zod` for catalog validation.
