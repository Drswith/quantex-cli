## 1. Ownership contract

- [x] 1.1 Complete OpenSpec proposal, design (including the ownership / seam draft), and spec deltas for `runtime-boundaries` and `compatibility-contract`
- [x] 1.2 Record the ADR 0015 follow-up note for deferred relocation slice 3 (state under Core, no CLI reassignment, config still unfolder)
- [x] 1.3 Point `AGENTS.md` Core/state triggers at `packages/core/src/state/` without expanding the handbook

## 2. Physical move

- [x] 2.1 Move `src/state/**` into `packages/core/src/state/**` and delete the root tree (no directory re-export shim); keep published `src/state.ts`
- [x] 2.2 Invert CLI `getConfigDir` through Core-owned host ports bound by `src/runtime/cli-state-host.ts`; own `SelfInstallSource` on the state schema with a CLI re-export
- [x] 2.3 Rewrite escaped imports; retarget CLI, Core engines, package-manager, lifecycle helpers, tests, and smoke scripts onto the Core-owned path
- [x] 2.4 Keep published `quantex-core` frozen (`createQuantex` + existing supported types only; do not publish state)
- [x] 2.5 Keep remaining deferred-Core lock/catalog edges as documented root imports; do not rewrite them into CLI-side semantics

## 3. Architecture enforcement

- [x] 3.1 Update `test/architecture/core-boundary.test.ts` so state lives under Core, Core → CLI is forbidden, deferred Core root modules may import relocated state, and type-leaf / catalog rules remain
- [x] 3.2 Retarget leftover scans, lifecycle ownership paths, and hardcoded `src/state/` assertions
- [x] 3.3 Preserve lazy mutation loading, published SDK freeze, and `first-party` exclusion assertions

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 4.4 Commit, push, and open a **draft** PR for #759 that includes the seam/ownership notes, moved vs deferred modules, and architecture-only changelog framing. Do not auto-ready. Do not cut a release.
