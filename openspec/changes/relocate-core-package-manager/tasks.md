## 1. Ownership contract

- [x] 1.1 Complete OpenSpec proposal, design (including the ownership / seam draft), and spec deltas for `runtime-boundaries` and `compatibility-contract`
- [x] 1.2 Record the ADR 0015 follow-up note for deferred relocation slice 1 (package-manager under Core, CLI seams inverted, providers/state still deferred)
- [x] 1.3 Point `AGENTS.md` Core triggers at `packages/core/src/package-manager/` without expanding the handbook

## 2. Seam inversion and physical move

- [x] 2.1 Add Core-owned package-manager host ports and a CLI binder; stop package-manager from importing `cli-context`, `config`, `cli-operation-context`, and `cli-child-process`
- [x] 2.2 Move `src/package-manager/**` into `packages/core/src/package-manager/**` and delete the root tree (no re-export shim)
- [x] 2.3 Rewrite escaped imports; retarget CLI, providers, state, agent-update, utils, Core engines, tests, and smokes onto the Core-owned path
- [x] 2.4 Keep published `quantex-core` frozen (`createQuantex` + existing supported types only; do not publish package-manager)

## 3. Architecture enforcement

- [x] 3.1 Update `test/architecture/core-boundary.test.ts` so package-manager lives under Core, Core → CLI is forbidden, deferred Core root modules may import relocated package-manager, and type-leaf / catalog rules remain
- [x] 3.2 Retarget leftover scans, ownership tests, provider-mutation boundary paths, and path-taxonomy off `src/package-manager`
- [x] 3.3 Preserve lazy mutation loading, published SDK freeze, and `first-party` exclusion assertions

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [ ] 4.2 Run `bun run test`
- [ ] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.4 Commit, push, and open a **draft** PR for #752 that includes the seam/ownership notes, moved vs deferred modules, and architecture-only changelog framing. Do not auto-ready. Do not cut a release.
