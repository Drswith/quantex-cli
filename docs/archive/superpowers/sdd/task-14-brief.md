# Task 14 Brief: Generate Catalog Support Inputs

## Objective

Generate deterministic agent/provider/platform/probe support data and a reviewable Markdown support matrix directly from validated normalized catalog source. Make stale checked-in outputs fail tests and generation.

## Boundary

- The generator parses every catalog file with the internal source schema.
- Support generation rejects remaining legacy methods instead of reconstructing provider identity from old fields.
- Generated data includes exact provider, platform, target kind, and declared probe coverage; it does not become a new runtime registry.
- Public v1 catalog schema and runtime exports remain unchanged.
- Durable support docs link to the generated provider matrix.

## Completion

- Add failing generator/content/stale-output tests first.
- Extend the existing catalog manifest generator and `agent-catalog:generate` path.
- Check in deterministic JSON and Markdown outputs.
- Run full gates, mark OpenSpec `4.14`, report, and checkpoint commit.
