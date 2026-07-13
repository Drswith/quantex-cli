### Task 4: Migrate list and info without v1 drift (OpenSpec 5.3)

**Files:**
- Modify: `src/commands/list.ts`
- Modify: `src/commands/info.ts`
- Modify: `test/commands/list.test.ts`
- Modify: `test/commands/info.test.ts`
- Modify: `test/compatibility/v1-baseline.test.ts`

**Interfaces:**
- Consumes: `observeRegisteredAgents`, `resolveAgentObservation`, and the v1 inspection projection.
- Produces: unchanged `list` and `info` `CommandResult` data and human presentation.

- [ ] **Step 1: Add route-boundary tests**

  Mock the new observation service, make legacy inspection calls fail if invoked, and assert existing success/error envelopes, ordering, source/update labels, versions, and install-method rendering.

- [ ] **Step 2: Route list/info through the new boundary**

  Keep the existing result interfaces and presenters unchanged. Do not expose drift, receipt, provider target, or capability arrays in v1 output.

- [ ] **Step 3: Run command and compatibility gates**

  Run:

  ```bash
  bun run test -- test/commands/list.test.ts test/commands/info.test.ts test/compatibility/v1-baseline.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(readonly): migrate list and info observations`
