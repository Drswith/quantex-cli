## 1. Ownership contract

- [x] 1.1 Complete OpenSpec proposal, design (including the ownership / seam draft), and spec deltas for `runtime-boundaries` and `compatibility-contract`
- [x] 1.2 Record the ADR 0015 follow-up note for deferred relocation slice 2 (providers under Core, no CLI reassignment, state still deferred)
- [x] 1.3 Point `AGENTS.md` Core triggers at `packages/core/src/providers/` without expanding the handbook

## 2. Physical move

- [ ] 2.1 Move `src/providers/**` into `packages/core/src/providers/**` and delete the root tree (no re-export shim)
- [ ] 2.2 Rewrite escaped imports; retarget CLI, Core engines, package-manager, agent-update, utils, tests, and build scripts onto the Core-owned path
- [ ] 2.3 Keep published `quantex-core` frozen (`createQuantex` + existing supported types only; do not publish providers)
- [ ] 2.4 Keep remaining deferred-Core util and catalog edges as documented root imports; do not rewrite them into CLI-side semantics

## 3. Architecture enforcement

- [ ] 3.1 Update `test/architecture/core-boundary.test.ts` so providers live under Core, Core → CLI is forbidden, deferred Core root modules may import relocated providers, and type-leaf / catalog / state-deferred rules remain
- [ ] 3.2 Retarget leftover scans, provider-mutation boundary paths, and hardcoded `src/providers` assertions
- [ ] 3.3 Preserve lazy mutation loading, published SDK freeze, and `first-party` exclusion assertions

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [ ] 4.2 Run `bun run test`
- [ ] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.4 Commit, push, and open a **draft** PR for #755 that includes the seam/ownership notes, moved vs deferred modules, and architecture-only changelog framing. Do not auto-ready. Do not cut a release.
