## Context

Current `upgrade` path (P5 `main`):

```text
command-contract/handlers.ts
  → src/commands/upgrade.ts          (JSON/human projection + error mapping)
    → src/services/self-upgrade-production.ts
         (CLI context, cancellation, runtime ports)
      → src/self/application.ts      (plan, then apply unless check/dry-run/non-available)
        → src/self planSelfUpgrade / upgradeSelf
```

Frozen user surface: command name `upgrade`, binaries `qtx`/`quantex`, `--check`,
`--channel`, `--json`, dry-run `DRY_RUN` warning, statuses
`up-to-date` | `check-unavailable` | `manual-required` | `update-available` |
`updated`, codes `NETWORK_ERROR` / `MANUAL_ACTION_REQUIRED` / `UPGRADE_FAILED`,
state schema v2.

Prior knives (install/ensure/update/uninstall/exec/doctor) placed an in-repo
Core engine under `src/core/*` that is absent from `src/core/index.ts` and
`packages/core`. Self-upgrade MUST stay a separate bounded context (ADR 0002 /
self-upgrade spec): do not fold it into `update-executor`.

Apply is the same invocation as plan/check (`runSelfUpgradeApplication` already
plans first and mutates only when status is `update-available` and neither
`--check` nor dry-run). Moving that orchestrator wholesale is isomorphic and
avoids a split engine.

## Goals / Non-Goals

**Goals:**

- Own plan / check / apply orchestration in in-repo Core.
- Reuse `src/self` domain modules; do not invent a second planner or mutator.
- Keep CLI as presentation + process policy (argv, cancellation, JSON/human, exit).
- Delete only proven zero-ref shells after the move.
- Lock frozen `--json` / `--check` / error codes / aliases with tests.
- Keep classify product-impacting via `src/` so macOS tests run.

**Non-Goals:**

- Published `quantex-core` `upgrade()` / SDK surface growth.
- New commands, aliases, flags, error codes, or schema fields.
- YAML, `release-core.yml`, protect-main.
- Folding `config` / `capabilities` / `commands` / `schema`.
- Touching shelved OpenSpec changes.
- Mixing self-upgrade into agent-lifecycle installation routing.
- Rewriting binary replacement, managed registry resolution, or lock internals.

## Decisions

1. **Dedicated Core self-upgrade engine, not agent `update`.**
   `src/core/self-upgrade-executor.ts` receives the current
   `runSelfUpgradeApplication` body. Domain planning/mutation stay in `src/self`.

2. **Production ports live in Core without `cli-context`.**
   The Core executor is port-injected and MUST NOT import `cli-context` or
   `src/self`. Runtime ports and domain plan/upgrade binding stay in the CLI
   production bridge.

3. **CLI production bridge binds `src/self` and CLI context.**
   `src/services/self-upgrade-production.ts` remains the CLI/self adapter:
   cancellation, invocation context, runtime ports, and `planSelfUpgrade` /
   `upgradeSelf`. Core executor MUST NOT import `src/self` or `cli-context`
   (architecture boundary in `test/architecture/core-boundary.test.ts`).
   Deleting this file would force Core to import self and fail that gate.

4. **Apply moves with plan/check.**
   Skipping apply would split one function into two engines. Apply remains
   `upgradeSelf` in `src/self`; Core only decides when to call it. Contracts
   stay frozen because mapping in `upgrade.ts` does not change.

5. **No engine/route in JSON.**
   Do not extend `installation-routing.ts` to `upgrade`. Do not add `engine` /
   `route` fields. Debug route reporting is not required for this knife.

6. **DELETE vs KEEP after import-graph and architecture-boundary proof.**

   | Module | Result | Reason |
   |---|---|---|
   | `src/self/application.ts` | DELETE | Orchestration relocates to Core executor; tests move with it. |
   | `src/core/self-upgrade-production.ts` | DELETE | Would import `src/self` and violate the Core architecture boundary. |
   | `src/services/self-upgrade-production.ts` | KEEP | Still differential: CLI context plus `src/self` port binding into Core. Required importer: `src/commands/upgrade.ts`. |
   | `src/self/planning.ts`, `facts.ts`, `index.ts`, providers, `binary.ts`, `lock.ts`, recovery, registry, state persistence | KEEP | Still differential domain; the production bridge calls them. |
   | `src/commands/upgrade.ts` | KEEP | Thin projector over the production bridge. |

7. **README wording.**
   CLI remains responsible for presentation and exit policy. In-repo Core owns
   upgrade plan/check/apply orchestration. Published SDK still has no `upgrade`
   method.

## Risks / Trade-offs

- **[Risk] Spy-based command tests break if the bridge binds `planSelfUpgrade` by static import.**
  → KEEP `import * as selfModule from '../self'` in the services production
  bridge so existing `vi.spyOn(selfModule, 'planSelfUpgrade' | 'upgradeSelf')`
  continues to work.

- **[Risk] Cancellation/stdio drift.**
  → Copy the current invocation options (`cacheMode` → `no-cache`/`refresh`,
  human `inherit` stdio vs structured `ignore/pipe/pipe`) verbatim.

- **[Risk] Accidental SDK export or Core importing `src/self`.**
  → Ownership tests assert `src/core/index.ts` and `packages/core/src/index.ts`
  omit the executor. Architecture boundary tests forbid `src/core/**` from
  importing `self`.

- **[Trade-off] Services production bridge remains.**
  Required: Core cannot import `src/self`. The bridge is still differential
  (CLI context + domain ports), not a zero-ref shell.
