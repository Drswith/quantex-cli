## 1. Core-internal modules

- [x] 1.1 Move `provider-binding.ts` and `provider-evidence.ts` to `src/core/lifecycle/` and fix relative imports (agents, providers, state, model leaf)
- [x] 1.2 Point remaining `src/lifecycle/*` modules and the barrel at the Core-internal modules
- [x] 1.3 Delete the old `src/lifecycle/provider-binding.ts` and `src/lifecycle/provider-evidence.ts` paths (no compatibility shims)
- [x] 1.4 Do not add `src/core/lifecycle/index.ts`

## 2. Importer retarget

- [x] 2.1 Update Core installation/uninstall/update/production-observation imports to `./lifecycle/provider-binding` and `./lifecycle/provider-evidence`
- [x] 2.2 Update `src/core/client.ts` to type-import `LifecycleProviderBinding` from provider-binding, not provider-evidence
- [x] 2.3 Update CLI, services, and tests that imported `src/lifecycle/provider-binding` or `src/lifecycle/provider-evidence`

## 3. Ownership lock and memory

- [x] 3.1 Update `test/core/lifecycle-core-ownership.test.ts` for the L2 graph (Core-internal modules present, old paths absent, state leaf-only, remaining engines still outside, SDK non-export)
- [x] 3.2 Update `test/architecture/core-boundary.test.ts` so `provider-binding` is no longer an allowed outside-Core eager dependency
- [x] 3.3 Add ADR 0012 recording Core-internal non-leaf binding/evidence vs the model leaf
- [x] 3.4 Extend the thin AGENTS.md lifecycle pointer to include provider-binding and ADR 0012

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [ ] 4.2 Run `bun run test`
- [ ] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [ ] 4.4 Commit, push, and open a **draft** PR with before/after import map, SDK non-export checklist, freeze checklist, and internal changelog framing
