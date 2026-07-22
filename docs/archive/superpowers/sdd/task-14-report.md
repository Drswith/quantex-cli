# Task 14 Report: Generate Catalog Support Inputs

## Result

OpenSpec `4.14` is complete. The existing catalog generation command now parses every source file through the normalized internal schema, rejects any remaining legacy method, and generates deterministic support inputs directly from provider-bound candidates.

Generated outputs include:

- `src/agents/generated/catalog-support.json`: per-agent provider/platform/target/probe inputs plus provider aggregates.
- `docs/generated/agent-provider-support.md`: reviewable provider counts, platforms, target kinds, and declared probes.

The durable support-matrix page links to the generated matrix and documents the expanded generation closure.

## Stale-output protection

- Generator tests compare checked-in JSON and Markdown with freshly built outputs.
- JSON generation uses the pinned formatter API at the repository print width, so `agent-catalog:generate` and `format` are byte-stable.
- Provider aggregates follow the compile-time first-party order; agent and coverage sets are sorted deterministically.

## Validation

- Focused generator/catalog suite: 2 files / 111 tests passed.
- Full suite: 82 files / 883 tests passed.
- Catalog manifest, public JSON schema, support JSON, and support Markdown regenerated successfully.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Milestone state

- Provider/catalog OpenSpec tasks `4.1` through `4.14` are complete.
- The redesign change remains active at 22/74; no archive or release closure is attempted.
- Milestone review, commit normalization, push, and PR to integration remain next.
