## Context

`src/agents/catalog-data.json` provides a single validated JSON-compatible catalog. It solves runtime validation but still creates a large-file review surface and keeps `src/agents/definitions/*.ts` as a compatibility layer that no longer owns data.

## Goals / Non-Goals

**Goals:**

- Keep `src/agents/catalog/` as a pure data directory containing only per-agent JSON files.
- Use a generated, checked-in TypeScript manifest for static imports and filename-based reproducible ordering.
- Validate that each filename matches the entry `name`.
- Keep named TypeScript exports such as `claude` available from `src/agents`.
- Preserve catalog contents and validation behavior while making catalog order filename-based.

**Non-Goals:**

- Do not add runtime directory scanning.
- Do not add a glob dependency for a flat catalog directory.
- Do not change supported agent metadata values.

## Decisions

- Use `node:fs/promises.readdir()` in the generation script. The catalog directory is flat, so a glob package would add dependency surface without meaningful value.
- Commit the generated manifest. It is build input with static imports, not a disposable build artifact.
- Order manifest entries by catalog filename to keep the rule obvious and reproducible; the ordering is not a catalog priority signal.
- Put generated code under `src/agents/generated/` and keep JSON data under `src/agents/catalog/`.
- Delete `src/agents/definitions/*.ts`; named agent constants are exported from the catalog adapter instead.

## Risks / Trade-offs

- Manifest drift can cause a new JSON file to be ignored -> add a test that regenerates the manifest in memory and compares it with the checked-in file.
- File/name mismatch can make lookup confusing -> make the generator reject mismatches before writing the manifest.
- Removing definition files breaks source-level imports from `src/agents/definitions/*` -> update repo tests to import from `src/agents`, which is the maintained internal surface.

## Migration Plan

1. Split `catalog-data.json` into `catalog/<agent>.json` files.
2. Add the manifest generator and checked-in manifest.
3. Update the catalog adapter to consume the manifest.
4. Remove `definitions/*.ts` compatibility files and keep named exports from the catalog adapter.
5. Update docs, tests, and package scripts.
