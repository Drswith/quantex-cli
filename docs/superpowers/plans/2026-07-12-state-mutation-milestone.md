# State and Mutation Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for any unexpected failure, `superpowers:requesting-code-review` before delivery, and `superpowers:verification-before-completion` before commit, push, or PR claims.

**Goal:** Complete OpenSpec `redesign-lifecycle-engine` tasks 6.1–6.8 on an isolated milestone branch, preserving the v1 state/library/CLI contract while routing `ensure`, `install`, and `uninstall` through verified lifecycle reconciliation.

**Architecture:** Keep `QuantexState`, `loadState`, `saveState`, and the maintained root exports as a v1 compatibility facade. Add an internal schema-versioned state document and state store that treat receipts as rebuildable management evidence. Migrate legacy state only while holding the existing state lock, retain a validated backup, and fail closed on any normalization or persistence failure. Mutation application follows `observe -> plan -> execute -> verify -> record`; a receipt is written only from live verification evidence. Introduce shadow planning before changing command routing and keep public v1 result, stream, exit, option, locking, cancellation, timeout, dry-run, non-interactive, and source-selection behavior stable.

**Scope:** OpenSpec tasks 6.1–6.8 only. Phase 5 read-only commands, update/idempotency, agent execution, self-upgrade, compatibility-facade removal, release, and archive closure are explicitly deferred.

**Delivery:** Work in `/Users/drs/.codex/worktrees/quantex-state-mutation` on `codex/redesign-state-mutation`, based on the latest `codex/redesign-lifecycle-integration`. Make recoverable local checkpoints while implementing. Before PR delivery, preserve the checkpoint history on a local backup ref, normalize the milestone to one reviewed commit, push, and create a PR whose base is `codex/redesign-lifecycle-integration`. Rebase merge is preferred; squash is the fallback; merge commits and automatic merge selection are prohibited.

---

## Invariants

1. The on-disk current document is internally versioned, but public `loadState()` continues to return exactly `{ installedAgents, self }` and public `saveState()` continues to accept that projection.
2. Reading valid legacy state is non-mutating. Migration occurs only inside a locked state mutation/current-document write, so read-only commands do not unexpectedly rewrite user files.
3. A pre-migration backup is retained until the new document is written, re-read, and validated. Failed migration restores or preserves the original byte-for-byte and surfaces `StateFileError`.
4. Unknown/future schema versions, invalid receipts, malformed legacy records, interrupted writes, and failed backup validation all fail closed.
5. Legacy installed-agent records are provenance, not proof. Receipt rebuilding requires current provider/executable verification evidence and never fabricates `verifiedAt`.
6. No command reports success or records a receipt before postconditions are verified. Failed execution, persistence, or verification retains diagnostic evidence and runs declared compensation where safe.
7. Every OpenSpec checkbox is marked only after its focused tests and relevant compatibility tests pass.

---

## Task 1: Add the internal versioned state and receipt store (OpenSpec 6.1)

**Create:**

- `src/state/schema.ts`
- `src/state/store.ts`
- `test/state/schema.test.ts`
- `test/state/store.test.ts`

**Modify:**

- `src/state/index.ts`
- `src/state.ts`
- `test/state.test.ts`
- `test/compatibility/v1-baseline.test.ts`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Write failing tests for a current schema document containing `schemaVersion`, the unchanged `installedAgents`/`self` projection, and lifecycle receipts keyed by target id.
2. Test strict receipt normalization: supported receipt version, non-empty provider/target identity, verified timestamp, and optional version/executable evidence. Reject unknown document/receipt versions.
3. Implement a pure parser/serializer and an internal store interface. Keep current-schema types internal; do not add root exports or alter the v1 fixture.
4. Make `loadState()` project current and legacy documents to the v1 shape. Make `saveState()` preserve existing valid receipts while replacing only the v1 projection.
5. Run:

   ```bash
   bun run test -- test/state/schema.test.ts test/state/store.test.ts test/state.test.ts test/compatibility/v1-baseline.test.ts
   bun run format:check
   bun run lint
   bun run typecheck
   ```

6. Mark only 6.1 complete and create local checkpoint `feat(state): add versioned lifecycle receipts`.

## Task 2: Implement atomic legacy migration and retained backup (OpenSpec 6.2)

**Modify:**

- `src/state/store.ts`
- `src/state/index.ts`
- `test/state/store.test.ts`
- `test/state.test.ts`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Write failing tests proving a legacy read is non-mutating and the first mutation creates a retained backup before replacing `state.json` with a validated current document.
2. Add injected filesystem/lock/clock dependencies around the store so migration stages are testable without process-global mocks; keep the default Node adapter behind the existing facade.
3. Under one state lock: read and normalize legacy bytes, write and validate the backup, write and validate a temporary current document, atomically rename it, then re-read the committed document. Never delete the retained migration backup in this milestone.
4. On failure, remove temporary files and preserve or restore the original bytes. Wrap infrastructure failures as `StateFileError` with a safe cause.
5. Verify focused state and v1 compatibility tests, then mark 6.2 and checkpoint `feat(state): migrate legacy state atomically`.

## Task 3: Add deterministic migration fault injection (OpenSpec 6.3)

**Create:**

- `test/state/migration-faults.test.ts`

**Modify:**

- `src/state/store.ts`
- `test/state/store.test.ts`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Build an in-memory fault-injectable store harness covering read, write, rename, validation, and restore boundaries.
2. Add failures for interrupted backup/current writes, invalid current/future schema, corrupt backup, failed replacement, failed post-write validation, and backup restore.
3. Simulate an older binary rewriting only `{ installedAgents, self }`; prove the next mutation preserves that projection and can accept newly live-verified evidence to rebuild a receipt. Prove no receipt is rebuilt without verification evidence.
4. Run the full state suite plus compatibility fixtures, mark 6.3, and checkpoint `test(state): cover migration fault recovery`.

## Task 4: Shadow current mutation plans without routing behavior (OpenSpec 6.4)

**Create:**

- `src/lifecycle/mutation-planner.ts`
- `src/lifecycle/shadow-planning.ts`
- `test/lifecycle/mutation-planner.test.ts`
- `test/lifecycle/shadow-planning.test.ts`

**Modify:**

- `src/lifecycle/index.ts`
- `src/commands/ensure.ts`
- `src/commands/install.ts`
- `src/commands/uninstall.ts`
- relevant command tests
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Write table tests for absent, already satisfied, tracked, untracked, ghost, conflicting, unsupported, and indeterminate observations.
2. Implement a pure deterministic planner using existing lifecycle models and registered provider capabilities.
3. Add a test-only shadow comparator that derives a new plan beside the current handler decision and reports structured mismatches. It must execute no new effect and emit nothing to stable user streams.
4. Exercise representative current handlers in shadow mode and make mismatches explicit test failures or captured test diagnostics; do not change default execution routing yet.
5. Run planner, command, lifecycle validation, and v1 protocol tests; mark 6.4 and checkpoint `test(lifecycle): shadow current mutation plans`.

## Task 5: Migrate ensure to verified reconciliation (OpenSpec 6.5)

**Create:**

- `src/lifecycle/reconcile.ts`
- `test/lifecycle/reconcile.test.ts`

**Modify:**

- `src/commands/ensure.ts`
- `src/state/store.ts`
- `test/commands/ensure.test.ts`
- `test/commands/state-read-error.test.ts`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Add failing tests for satisfied no-op, absent install, verified adoption, ghost/conflicting evidence, provider failure, verification failure, and receipt persistence failure.
2. Implement an application reconciler over invocation ports, provider registry, planner, verifier, and state store. Record a receipt only after satisfied postconditions.
3. Route `ensure` through the reconciler while preserving current human/JSON output and exit mapping at the command boundary.
4. Prove dry-run performs no mutation/receipt write and that a persistence failure cannot be reported as success.
5. Run focused ensure/reconcile/state/compatibility tests; mark 6.5 and checkpoint `refactor(ensure): reconcile verified lifecycle state`.

## Task 6: Migrate single and batch install (OpenSpec 6.6)

**Modify:**

- `src/commands/install.ts`
- `src/lifecycle/reconcile.ts`
- `src/lifecycle/mutation-planner.ts`
- relevant install/lifecycle tests
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Write failing tests for single success/failure, mixed batch outcomes, deterministic target order, cancellation, verification failure, and safe compensation after partial execution.
2. Route single install through the reconciler and map typed internal outcomes back to the existing v1 result/error contract.
3. Compose batch installs from independent target plans; preserve successful verified receipts, return typed partial internal outcomes, and do not convert a partial failure into global success.
4. Execute compensation only when declared and safe; never erase a previously verified installation merely because another batch member failed.
5. Run install, cancellation e2e, state, lifecycle, and compatibility suites; mark 6.6 and checkpoint `refactor(install): execute verified lifecycle plans`.

## Task 7: Migrate uninstall reconciliation (OpenSpec 6.7)

**Modify:**

- `src/commands/uninstall.ts`
- `src/lifecycle/reconcile.ts`
- `src/lifecycle/mutation-planner.ts`
- `test/commands/uninstall.test.ts`
- relevant state/lifecycle tests
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Write failing tests for managed removal, unmanaged live executable, conclusive ghost receipt, indeterminate provider evidence, provider failure, and post-uninstall verification failure.
2. Require matching receipt/provider target evidence before provider removal. PATH presence alone never authorizes a guessed package uninstall.
3. Clear a receipt only after verified managed absence or conclusive ghost evidence. Retain it on provider/verification failure.
4. Preserve v1 rendering and exit behavior while keeping internal unmanaged/ghost/provider-failure/verification-failure outcomes distinct.
5. Run uninstall, state, lifecycle, and compatibility suites; mark 6.7 and checkpoint `refactor(uninstall): reconcile lifecycle receipts`.

## Task 8: Cross-cutting mutation semantics and milestone verification (OpenSpec 6.8)

**Modify:**

- relevant ensure/install/uninstall/runtime tests
- `test/managed-installer-cancellation.e2e.test.ts`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Steps:**

1. Add/extend matrix tests proving each migrated route preserves state/provider locks, per-invocation cancellation, timeout, dry-run, non-interactive behavior, and recorded-source preference.
2. Exercise Unix process-tree cancellation locally and retain Windows-capable CI coverage; do not weaken platform assertions to make a local environment pass.
3. Run focused command/runtime/e2e suites, then the complete milestone gate:

   ```bash
   bun run format
   bun run lint
   bun run format:check
   bun run typecheck
   bun run test
   bun run openspec:validate
   bun run memory:check
   bun run build
   ```

4. Mark only 6.8 after all evidence passes and checkpoint `test(lifecycle): verify mutation runtime semantics`.

## Task 9: Review, normalize, push, and PR to integration

**Steps:**

1. Confirm OpenSpec reports 30/74, tasks 6.1–6.8 are the only newly checked redesign tasks, and the umbrella change remains active.
2. Request independent spec and code-quality review. Resolve blocker/important findings with TDD and rerun affected/full gates.
3. Fetch origin and verify integration has not advanced unexpectedly. If it has, rebase the milestone onto latest integration and rerun the full gate.
4. Preserve granular checkpoints on local ref `codex/redesign-state-mutation-checkpoints`, then normalize the delivery branch to one commit:

   ```text
   refactor: migrate lifecycle state and core mutations
   ```

5. Push `codex/redesign-state-mutation`. Build the PR body from `.github/pull_request_template.md`, validate it with `bun run pr:body:check`, and create a ready PR targeting `codex/redesign-lifecycle-integration`.
6. Verify all required CI, Sandbox, OpenSpec, memory, and governance checks. Confirm no Release workflow/npm publication was triggered.
7. After review approval, rebase-merge with expected-head protection. Use squash only if rebase is unavailable/unsafe and record why. Never select merge commit or auto-merge.
8. Verify the merged integration tree equals the reviewed milestone tree, integration remains non-publishing, and the redesign change stays active. Create the next milestone only from the new remote integration head.
