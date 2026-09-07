## Context

After L3, Core owns receipt types and remaining engines under `src/core/lifecycle/`. The only leftover under `src/lifecycle/` is a barrel that re-exports those Core-internal modules for CLI/services/idempotency that still imported `from '../lifecycle'`.

Current leftover graph:

```text
src/services/lifecycle-execution-production  ──imports──► src/lifecycle  (LifecycleOutcome)
src/idempotency/lifecycle-policy             ──imports──► src/lifecycle  (receipt/binding + observeLifecycleProvider)
tests (commands/services/idempotency/lifecycle/*) ──imports──► src/lifecycle
src/lifecycle/index.ts                       ──re-exports──► src/core/lifecycle/*
src/state                                    ──imports──► src/core/lifecycle/model  (leaf only; ADR 0011)
```

ADR 0013 forbade treating L3 as permission to delete the barrel. L4 is that dedicated change. PM authorized the knife. The published SDK stays frozen: no new exports, no `src/core/lifecycle/index.ts`.

## Goals / Non-Goals

**Goals:**

- Retarget remaining production and test barrel imports onto Core-internal modules.
- Delete `src/lifecycle/` with no shim.
- Preserve frozen contracts: state v2, receipt JSON shape, `--json`, aliases, exit codes, no `engine`/`route` in JSON.
- Keep published SDK export surface identical (`createQuantex` + existing inspection/mutation types only).
- Lock the L4 graph so the barrel cannot return and `state` cannot import Core runtime or non-leaf engines.

**Non-Goals:**

- Expanding commands or `packages/core` / `src/core/index.ts`.
- Adding `src/core/lifecycle/index.ts`.
- Folding config, capabilities, commands, or schema registries.
- YAML, `release-core.yml`, protect-main, or shelved OpenSpec changes.
- Archiving L2 (`lifecycle-provider-core-internal-l2`) or L3 (`lifecycle-engines-core-internal-l3`); those archives stay separate PRs.
- Moving `test/lifecycle/` tests; that directory tests Core-internal modules and is not the deleted product path.

## Decisions

### 1. Direct Core-internal imports, then delete the barrel

Retarget callers onto the existing files:

- types such as `LifecycleOutcome` / `LifecycleReceipt` / `LifecycleObservation` → `src/core/lifecycle/model.ts`
- `LifecycleProviderBinding` → `src/core/lifecycle/provider-binding.ts`
- `observeLifecycleProvider`, `providerBindingsEqual`, `resolveReceiptProviderBinding` → `src/core/lifecycle/provider-evidence.ts`
- `observeAgentLifecycle` and observation port types → `src/core/lifecycle/agent-observation.ts`
- `planLifecycleUpdate` / `projectLifecycleProviderCapabilities` → `src/core/lifecycle/update-planner.ts`

Minimum production sites named by this knife: `lifecycle-execution-production` and `lifecycle-policy`. Related tests that imported the barrel MUST retarget too, or the directory cannot be deleted.

Do **not** add `src/core/lifecycle/index.ts`. A Core-internal barrel would recreate the facade L4 is deleting and could pull extra modules into the published SDK eager/complete closure.

`src/core/index.ts` and `packages/core/src/index.ts` MUST NOT re-export these symbols.

### 2. No compatibility shim at `src/lifecycle`

L4 is a deletion, not a leftover. A shim at `src/lifecycle/index.ts` would keep the old path Core is deleting. After retarget, `git rm` the directory.

### 3. Ownership locks replace the L3 “barrel still exists” assertions

L3 ownership tests required `src/lifecycle/index.ts`. L4 inverts that:

- `src/lifecycle/` is absent (no `index.ts`, no engine files)
- `src/core/lifecycle/index.ts` remains absent
- remaining named callers import Core-internal modules, not `../lifecycle`
- `src/state` still imports only `../core/lifecycle/model`
- published SDK root still omits lifecycle helper symbols

### 4. Changelog is internal

No user-visible command, JSON, or SDK change. Release framing is `refactor:` so release-please files it under Internal Improvements and does not bump from this knife alone.

## Risks / Trade-offs

- [Risk] Someone restores `src/lifecycle/` or adds `src/core/lifecycle/index.ts` as a convenience barrel. → Mitigation: ownership tests fail if either path exists; ADR 0014 records the prohibition.
- [Risk] `state` starts importing observation, evidence, or Core runtime after the barrel is gone. → Mitigation: existing leaf-only state lock stays; L4 does not add state imports.
- [Risk] Deleting the barrel expands `quantex-core` by “making helpers easier to import from Core”. → Mitigation: no SDK re-export; architecture/import-purity tests keep `createQuantex` as the only runtime export.
- [Risk] L3 archive later re-asserts “the barrel stays”. → Mitigation: this change’s spec delta records that the later knife completed; L3 archive MUST NOT copy the leftover barrel-exists requirement into `openspec/specs/` after L4 lands. Do not edit the L2/L3 change directories from this branch.
- [Trade-off] CLI services, idempotency, and tests now name specific Core-internal files instead of one facade. That is the point of the knife.

## Migration Plan

1. Retarget remaining barrel importers (production first, then tests).
2. Delete `src/lifecycle/` (no shims).
3. Update ownership tests; add ADR 0014; thin AGENTS.md pointer (drop `src/lifecycle/`).
4. Run lint/format/typecheck/test/openspec/memory.
5. Draft PR; keep draft. Do not archive this OpenSpec change until the implementation PR merges and spec deltas are synced. Do not archive L2 or L3 from this branch.

Rollback: revert the PR. No persisted-state migration.

## Open Questions

None. PM authorized L4; placement is deletion of the leftover barrel, not a new facade.
