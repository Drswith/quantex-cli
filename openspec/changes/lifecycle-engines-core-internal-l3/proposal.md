## Why

L1 moved receipt types into `src/core/lifecycle/model.ts` and L2 moved provider-binding/evidence into Core-internal modules, but Core observation, update, execution, and uninstall still import remaining engines from `src/lifecycle`. That leftover reverse edge is the next knife: Core already owns those helpers in practice. L3 relocates only `agent-observation`, `update-planner`, `agent-execution`, and `uninstall-postcondition` into Core-internal paths without expanding the published SDK.

Work-intake classification: architecture boundary plus project-memory (OpenSpec/ADR). Observable CLI behavior, state v2, `--json`, aliases, and exit codes MUST stay frozen. OpenSpec is required before edits.

## What Changes

- Move `src/lifecycle/agent-observation.ts`, `update-planner.ts`, `agent-execution.ts`, and `uninstall-postcondition.ts` to Core-internal modules under `src/core/lifecycle/`.
- Retarget every matching import, including Core observation/update/execution/uninstall, CLI services, planning, remaining `src/lifecycle` barrel, and tests.
- Keep the `src/lifecycle` barrel in place for L4 (do not delete `src/lifecycle/`). The barrel MAY re-export the moved helpers as an existing non-SDK path.
- Keep published `src/core/index.ts` / `packages/core` free of observation/planner/execution/postcondition exports. Do not add `src/core/lifecycle/index.ts`.
- Lock the L3 import graph in ownership tests: state may import only the model leaf, never the moved engines or Core runtime; Core runtime imports them from `./lifecycle/`, not `../lifecycle/`.
- Record that these modules are Core-internal but **not** leaves as ADR 0013 so later knives do not recreate the P8 inversion and do not treat L3 as permission to delete the barrel.

**Not changing** (deliberately):

- No L4 deletion of `src/lifecycle/` or of the remaining barrel.
- No new CLI commands, no SDK method/type surface growth, no fold of config/capabilities/commands/schema.
- No YAML / `release-core.yml` / protect-main changes.
- Shelved OpenSpec changes stay untouched: `release-one-line-delivery`, `release-pr-skip-human-heuristics`, `windows-ci-advisory-merge-gate`.
- Do not start or conflict with L2 OpenSpec archive of `lifecycle-provider-core-internal-l2`.
- State v2 receipt JSON shape, aliases, exit codes, and JSON omission of `engine` / `route` stay frozen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: Core owns internal agent-observation, update-planner, agent-execution, and uninstall-postcondition helpers; the `src/lifecycle` barrel stays outside Core for later knives; published SDK root MUST NOT export those helpers; `src/state` MUST NOT import them.
- `compatibility-contract`: internalizing those engines MUST NOT expand `quantex-core` exports or drift frozen v1 JSON, aliases, exit codes, or state v2.

## Impact

- `src/core/lifecycle/{agent-observation,update-planner,agent-execution,uninstall-postcondition}.ts` (new Core-internal modules); old `src/lifecycle/` copies removed (no shims)
- Importers: Core production-observation/update/execution/uninstall, services, planning, lifecycle barrel, tests
- `test/core/lifecycle-core-ownership.test.ts` and `test/architecture/core-boundary.test.ts` (L3 import-graph lock)
- `docs/adr/0013-core-internal-lifecycle-engines.md`
- Changelog framing is **internal** (`refactor:` / Internal Improvements); no user-facing CLI or SDK change
