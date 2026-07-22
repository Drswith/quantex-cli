# Managed Installer Cancellation E2E Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the managed-installer cancellation e2e semantically strict while making its nested timeout budgets robust under full-suite runner load.

**Architecture:** Preserve the production cancellation path and all observable state/signal assertions. Increase the inner runtime deadline enough for the fake Cargo install to start under load, then establish ordered safety budgets so a broken cancellation still fails through the fake process fallback before the outer watchdog and Vitest timeout; remove the wall-clock duration assertion because performance is not the behavior contract.

**Tech Stack:** TypeScript, Bun, Vitest 4, Node child processes.

## Global Constraints

- This is test-only cleanup; do not create or update an OpenSpec change.
- Modify only `test/managed-installer-cancellation.e2e.test.ts` and this implementation plan.
- Do not modify production cancellation, process, package-manager, state, or runtime code.
- Preserve assertions for `TIMEOUT`, no success output, no persisted installed state, Cargo invocation, no fallback completion, and non-Windows `SIGTERM` receipt.
- Keep the ordered budget relationship `2_000ms runtime timeout < 30_000ms fake Cargo fallback < 45_000ms command watchdog < 60_000ms Vitest timeout`.
- The regression RED is the fresh canonical full-suite run that reported 60 passed files, 1 failed file, and 709/710 tests because this e2e hit its existing 10,000ms Vitest timeout; focused reruns completed in about 1.5 seconds.
- Deliver exactly one conventional `test(install): ...` commit to a PR targeting `main`.
- This test-only PR must not intentionally trigger an npm release.

---

### Task 1: Establish Ordered E2E Safety Budgets

**Files:**
- Modify: `test/managed-installer-cancellation.e2e.test.ts`
- Modify: `docs/superpowers/plans/2026-07-11-stabilize-managed-installer-cancellation-e2e.md`

**Interfaces:**
- Consumes: `runCommand`, the fake Cargo process, `QTX_CANCELLATION_SMOKE_TIMEOUT_MS`, and Vitest's per-test timeout.
- Produces: an e2e that still proves cancellation semantics but does not use a 10-second wall-clock race as its test oracle.

- [x] **Step 1: Record the RED and focused baseline**

Record the existing full-suite failure:

```text
Test Files  1 failed | 60 passed (61)
Tests       1 failed | 709 passed (710)
Error: Test timed out in 10000ms.
```

Run the unchanged focused test:

```bash
bun run test -- test/managed-installer-cancellation.e2e.test.ts
```

Expected locally: PASS in roughly 1-3 seconds, proving the failure is full-suite load sensitivity rather than a deterministic cancellation regression.

- [x] **Step 2: Replace the wall-clock assertion with ordered safety budgets**

Change the smoke runtime deadline to 2 seconds:

```typescript
QTX_CANCELLATION_SMOKE_TIMEOUT_MS: '2000',
```

Remove only this load-sensitive performance assertion:

```typescript
expect(output.durationMs).toBeLessThan(4_000)
```

Keep all semantic assertions unchanged. Set the fake Cargo fallback to 30 seconds:

```typescript
'setTimeout(() => complete("fake cargo completed without cancellation"), 30_000)',
```

Set the `runCommand` watchdog to 45 seconds:

```typescript
}, 45_000)
```

Set the Vitest per-test timeout to 60 seconds:

```typescript
}, 60_000)
```

- [x] **Step 3: Verify the focused GREEN path repeatedly**

Run:

```bash
for run in {1..5}; do bun run test -- test/managed-installer-cancellation.e2e.test.ts || exit 1; done
```

Expected: all 5 runs pass; each still observes `TIMEOUT`, `SIGTERM` on non-Windows, and no persisted success.

- [x] **Step 4: Verify the full-suite load path**

Run the canonical suite three times sequentially:

```bash
for run in {1..3}; do bun run test || exit 1; done
```

Expected: each run reports 61 passed files, 710 passed tests, and 0 failures.

- [x] **Step 5: Run repository validation**

Run each command independently:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run openspec:validate
bun run memory:check
```

Expected: every command exits 0; OpenSpec reports 15 passed items and project memory passes.

- [x] **Step 6: Self-review and commit**

Confirm the two-file boundary and clean diff:

```bash
git diff --check
git diff --stat
git status --short
```

Mark each checkbox complete only after its evidence exists, then stage exactly the two planned files and commit:

```bash
git add docs/superpowers/plans/2026-07-11-stabilize-managed-installer-cancellation-e2e.md test/managed-installer-cancellation.e2e.test.ts
git commit -m "test(install): stabilize managed cancellation e2e"
```

Expected: exactly one commit is created and the working tree is clean.
