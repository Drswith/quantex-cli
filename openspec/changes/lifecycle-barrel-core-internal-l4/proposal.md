## Why

L1–L3 moved lifecycle receipt types and engines into Core-internal modules, but a leftover `src/lifecycle` barrel still re-exports them as a non-SDK facade. Remaining callers (`lifecycle-execution-production`, `lifecycle-policy`, and matching tests) still import that barrel. L4 is the authorized knife that retargets those imports onto Core-internal paths and deletes `src/lifecycle/`.

Work-intake classification: architecture boundary plus project-memory (OpenSpec/ADR). Observable CLI behavior, state v2, `--json`, aliases, and exit codes MUST stay frozen. OpenSpec is required before edits.

## What Changes

- Retarget every remaining `src/lifecycle` barrel import onto Core-internal modules under `src/core/lifecycle/`, including at least `src/services/lifecycle-execution-production.ts`, `src/idempotency/lifecycle-policy.ts`, and related tests.
- Delete `src/lifecycle/` (the barrel `index.ts` and the directory). Do not leave a shim.
- Keep published `src/core/index.ts` / `packages/core` free of lifecycle helper exports. Do not add `src/core/lifecycle/index.ts`.
- Lock the L4 graph in ownership tests: `src/lifecycle/` is absent, remaining callers use Core-internal direct imports, `src/state` still imports only the model leaf, and the published SDK root stays unchanged.
- Record barrel deletion as ADR 0014 so later work does not restore `src/lifecycle/` or invent a Core lifecycle barrel.

**Not changing** (deliberately):

- No new CLI commands, no SDK method/type surface growth, no fold of config/capabilities/commands/schema.
- No YAML / `release-core.yml` / protect-main changes.
- Shelved OpenSpec changes stay untouched: `release-one-line-delivery`, `release-pr-skip-human-heuristics`, `windows-ci-advisory-merge-gate`.
- Do not start or conflict with L2/L3 OpenSpec archive of `lifecycle-provider-core-internal-l2` or `lifecycle-engines-core-internal-l3`.
- State v2 receipt JSON shape, aliases, exit codes, and JSON omission of `engine` / `route` stay frozen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: remaining callers import Core-internal lifecycle modules directly; `src/lifecycle/` is absent; published SDK root MUST NOT export those helpers; `src/core/lifecycle/index.ts` MUST NOT exist; `src/state` MUST NOT import Core runtime or non-leaf lifecycle engines.
- `compatibility-contract`: deleting the leftover barrel MUST NOT expand `quantex-core` exports or drift frozen v1 JSON, aliases, exit codes, or state v2.

## Impact

- Remaining barrel importers: `src/services/lifecycle-execution-production.ts`, `src/idempotency/lifecycle-policy.ts`, and tests that imported `src/lifecycle`
- Deleted path: `src/lifecycle/` (`index.ts` barrel only after L3)
- `test/core/lifecycle-core-ownership.test.ts` (L4 import-graph lock)
- `docs/adr/0014-core-internal-lifecycle-barrel-deletion.md`
- Changelog framing is **internal** (`refactor:` / Internal Improvements); no user-facing CLI or SDK change
