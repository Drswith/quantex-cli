## Why

L1 moved receipt types into `src/core/lifecycle/model.ts`, but Core install/uninstall/update/execution still import provider-binding helpers from `src/lifecycle`. That leftover reverse edge is the next knife: Core already owns those resolvers in practice. L2 relocates only `provider-binding` and `provider-evidence` into Core-internal paths without expanding the published SDK.

Work-intake classification: architecture boundary plus project-memory (OpenSpec/ADR). Observable CLI behavior, state v2, `--json`, aliases, and exit codes MUST stay frozen. OpenSpec is required before edits.

## What Changes

- Move `src/lifecycle/provider-binding.ts` and `src/lifecycle/provider-evidence.ts` to Core-internal modules at `src/core/lifecycle/provider-binding.ts` and `src/core/lifecycle/provider-evidence.ts`.
- Retarget every `../lifecycle/provider-binding`, `../lifecycle/provider-evidence`, `./provider-binding`, and matching test import, including Core install/uninstall/update/execution, CLI, remaining `src/lifecycle/*` modules, and the lifecycle barrel.
- Keep remaining `src/lifecycle/*` engines in place for L3+ (agent-observation, update-planner, agent-execution, uninstall-postcondition, barrel).
- Keep published `src/core/index.ts` / `packages/core` free of binding/evidence exports. Existing non-SDK paths (the `src/lifecycle` barrel) MAY re-export helpers already required by CLI/services.
- Lock the L2 import graph in ownership tests: state may import only the model leaf, never provider-binding/evidence or Core runtime; Core runtime imports binding/evidence from `./lifecycle/`, not `../lifecycle/`.
- Record that these modules are Core-internal but **not** leaves (they may import agents, providers, and type-only state) as ADR 0012 so later knives do not recreate the P8 inversion.

**Not changing** (deliberately):

- No L3+ moves (observation / update-planner / agent-execution / uninstall-postcondition) and no deletion of `src/lifecycle/`.
- No new CLI commands, no SDK method/type surface growth, no fold of config/capabilities/commands/schema.
- No YAML / `release-core.yml` / protect-main changes.
- Shelved OpenSpec changes stay untouched: `release-one-line-delivery`, `release-pr-skip-human-heuristics`, `windows-ci-advisory-merge-gate`.
- Do not start or conflict with L1 OpenSpec archive of `lifecycle-model-core-internal-l1`.
- State v2 receipt JSON shape, aliases, exit codes, and JSON omission of `engine` / `route` stay frozen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: Core owns internal provider-binding resolution and provider-evidence observation helpers; remaining `src/lifecycle` engines stay outside Core for later knives; published SDK root MUST NOT export those helpers; `src/state` MUST NOT import them.
- `compatibility-contract`: internalizing provider-binding/evidence MUST NOT expand `quantex-core` exports or drift frozen v1 JSON, aliases, exit codes, or state v2.

## Impact

- `src/core/lifecycle/provider-binding.ts` and `src/core/lifecycle/provider-evidence.ts` (new Core-internal modules); old `src/lifecycle/` copies removed (no shims)
- Importers: Core installation/uninstall/update/execution, CLI (`core-installation-cli`), services, remaining `src/lifecycle/*`, tests
- `test/core/lifecycle-core-ownership.test.ts` and `test/architecture/core-boundary.test.ts` (L2 import-graph lock)
- `docs/adr/0012-core-internal-lifecycle-provider-binding.md`
- Changelog framing is **internal** (`refactor:` / Internal Improvements); no user-facing CLI or SDK change
