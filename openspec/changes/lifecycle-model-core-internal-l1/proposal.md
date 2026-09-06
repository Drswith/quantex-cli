## Why

P8 (#717) kept `src/lifecycle/model` outside Core because a naive fold would make `src/state` depend on Core runtime and invert the existing `Core → state` edge. That leftover is now the first reverse-dependency knife: Core still imports receipt types from `src/lifecycle`, so in-repo Core is not yet the owner of its own lifecycle evidence types. L1 moves only that leaf into a Core-internal path without expanding the published SDK.

Work-intake classification: architecture boundary plus project-memory (OpenSpec/ADR). Observable CLI behavior, state v2, `--json`, aliases, and exit codes MUST stay frozen. OpenSpec is required before edits.

## What Changes

- Move `src/lifecycle/model` (receipt/observation types and `LIFECYCLE_RECEIPT_SCHEMA_VERSION`) to a Core-internal leaf at `src/core/lifecycle/model.ts`.
- Retarget every `../lifecycle/model` / `src/lifecycle/model` / `./model` import, including Core installation/uninstall modules, `src/state/*`, `src/package-manager`, remaining `src/lifecycle/*` modules, and tests.
- Keep remaining `src/lifecycle/*` modules in place for L2+ (provider-binding/evidence, observation, update-planner, agent-execution, uninstall-postcondition, barrel).
- Keep published `src/core/index.ts` / `packages/core` free of new lifecycle exports. Existing non-SDK paths (the `src/lifecycle` barrel, `src/state/schema`) MAY re-export types/constants already required by CLI/state.
- Lock the L1 import graph in ownership tests: state may import only the Core-internal leaf, never Core runtime.
- Record the leaf-vs-runtime distinction as an ADR so later knives do not recreate the P8 inversion.

**Not changing** (deliberately):

- No L2+ moves or deletion of `src/lifecycle/`.
- No new CLI commands, no SDK method/type surface growth, no fold of config/capabilities/commands/schema.
- No YAML / `release-core.yml` / protect-main changes.
- Shelved OpenSpec changes stay untouched: `release-one-line-delivery`, `release-pr-skip-human-heuristics`, `windows-ci-advisory-merge-gate`.
- State v2 receipt JSON shape, aliases, exit codes, and JSON omission of `engine` / `route` stay frozen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: Core owns the internal lifecycle receipt/observation type leaf; remaining `src/lifecycle` modules stay outside Core for later knives; published SDK root MUST NOT export that leaf.
- `compatibility-contract`: internalizing the lifecycle model MUST NOT expand `quantex-core` exports or drift frozen v1 JSON, aliases, exit codes, or state v2.

## Impact

- `src/core/lifecycle/model.ts` (new leaf), `src/lifecycle/model.ts` (removed)
- Importers: `src/core/installation-*`, `src/core/uninstall-executor`, `src/state/*`, `src/package-manager`, remaining `src/lifecycle/*`, tests
- `test/core/lifecycle-core-ownership.test.ts` (L1 import-graph lock)
- `docs/adr/0011-core-internal-lifecycle-model-leaf.md`
- Changelog framing is **internal** (`refactor:` / Internal Improvements); no user-facing CLI or SDK change
