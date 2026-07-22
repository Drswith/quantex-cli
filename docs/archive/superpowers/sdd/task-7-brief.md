### Task 7: Real-environment comparison and milestone closure (OpenSpec 5.7)

**Files:**
- Create: `scripts/read-only-lifecycle-smoke.ts`
- Create: `test/read-only-lifecycle-smoke.test.ts`
- Modify: `package.json`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Interfaces:**
- Consumes: the six migrated commands through the real CLI in a temporary HOME and the existing compatibility fixtures.
- Produces: deterministic local/container smoke evidence without mutating agent/provider state.

- [x] **Step 1: Add a smoke harness test**

  Run `list`, `info`, `inspect`, `resolve`, `capabilities`, and `doctor` in human and JSON modes against absent, tracked, untracked, and ghost fixtures. Assert parseable structured stdout, expected stable fields/error codes, no state-file byte changes, and no install/update/uninstall process invocation.

- [x] **Step 2: Run the harness locally and in Bun container**

  Run:

  ```bash
  bun run test:readonly-smoke
  docker run --rm -v "$PWD:/mnt/quantex-cli:ro" oven/bun:1.3.11 sh -lc 'mkdir /tmp/quantex-work && cd /mnt/quantex-cli && tar --exclude=.git --exclude=node_modules --exclude=dist -cf - . | tar -xf - -C /tmp/quantex-work && cd /tmp/quantex-work && bun install --frozen-lockfile && bun run test:readonly-smoke'
  ```

  Expected: both environments pass; host-dependent availability/version values are normalized rather than golden-locked.

- [x] **Step 3: Run the complete milestone gate**

  Run:

  ```bash
  bun run format
  bun run format:check
  bun run lint
  bun run typecheck
  bun run test
  bun run openspec:validate
  bun run memory:check
  bun run build
  ```

- [x] **Step 4: Mark only OpenSpec 5.1–5.7 complete**

  Confirm `bun run openspec:list` reports 37/74. Keep `redesign-lifecycle-engine` active and do not sync current specs or archive.

  Commit: `test(readonly): verify observation migration`
