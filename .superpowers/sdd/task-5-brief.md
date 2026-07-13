### Task 5: Migrate inspect and resolve without v1 drift (OpenSpec 5.4)

**Files:**
- Modify: `src/commands/inspect.ts`
- Modify: `src/commands/resolve.ts`
- Modify: `test/commands/inspect.test.ts`
- Modify: `test/commands/resolve.test.ts`
- Modify: `test/compatibility/v1-baseline.test.ts`

**Interfaces:**
- Consumes: resolved agent observation and v1 projection.
- Produces: unchanged inspect capabilities/inspection fields and resolve success/guidance/error contracts.

- [ ] **Step 1: Add failing route and compatibility tests**

  Cover installed managed, installed untracked, absent, ghost, conflicting/indeterminate, alias, unknown, and install-guidance cases. Lock `AGENT_NOT_FOUND`, `AGENT_NOT_INSTALLED`, docs refs, suggested ensure command, launch argv, source label, install source, and capabilities.

- [ ] **Step 2: Route inspect/resolve through observation**

  A ghost or inconclusive internal state must not be reported installed solely from persisted state. Preserve existing install guidance and strict structured fields.

- [ ] **Step 3: Run focused and protocol gates**

  Run:

  ```bash
  bun run test -- test/commands/inspect.test.ts test/commands/resolve.test.ts test/compatibility/v1-baseline.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(readonly): migrate inspect and resolve observations`
