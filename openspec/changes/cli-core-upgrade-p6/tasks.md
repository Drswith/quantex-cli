## 1. Inventory and OpenSpec

- [x] 1.1 Record the current upgrade path (handlers → command → services production → application → `src/self`) and the frozen JSON/check/error contracts in design.md.
- [x] 1.2 Write proposal/design/tasks plus spec deltas for `self-upgrade`, `runtime-boundaries`, `compatibility-contract`, and `product-readme`.
- [x] 1.3 Confirm shelved changes and YAML/`release-core.yml` stay untouched.

## 2. Core engine and thin CLI

- [x] 2.1 Add `src/core/self-upgrade-executor.ts` with the current plan/check/apply orchestration (no `cli-context`).
- [x] 2.2 Rewrite `src/services/self-upgrade-production.ts` as the CLI/self
      bridge that injects `planSelfUpgrade` / `upgradeSelf` into Core
      (namespace import so command spies still work). KEEP this file.
- [x] 2.3 Point `src/commands/upgrade.ts` at the production bridge; keep frozen
      projection, codes, `--check` / dry-run mapping; do not emit engine/route.
- [x] 2.4 Delete `src/self/application.ts` after zero-ref proof. KEEP remaining
      `src/self` domain modules. Do not put `src/self` imports under `src/core/`.
- [x] 2.5 Do not re-export the Core executor from `src/core/index.ts` or
      `packages/core`.

## 3. Contract locks and docs

- [x] 3.1 Add Core ownership tests (CLI → Core, no public SDK `upgrade()`, no `cli-context` in executor, deleted shells gone).
- [x] 3.2 Extend upgrade command tests so `--json` omits engine/route and `--check` / `NETWORK_ERROR` / `MANUAL_ACTION_REQUIRED` / aliases stay locked.
- [x] 3.3 Move application orchestration tests onto the Core executor.
- [x] 3.4 Update living specs plus `README.md`, `README.zh-CN.md`, and `packages/core/README.md` for the Core-backed upgrade route.

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`.
- [ ] 4.2 Commit, push, and open one draft PR whose body includes the before/after path map, DELETE vs KEEP table, and contract freeze checklist.
