### Task 3: Add the read-only application and v1 projection boundary

**Files:**
- Create: `src/services/lifecycle-observations.ts`
- Create: `src/compatibility/agent-inspection.ts`
- Create: `test/services/lifecycle-observations.test.ts`
- Create: `test/compatibility/agent-inspection.test.ts`
- Modify: `src/services/agents.ts`

**Interfaces:**
- Consumes: agent registry, live observer, current catalog method formatting inputs, and existing `AgentInspection` semantics.
- Produces: `resolveAgentObservation(name)` and `observeRegisteredAgents()` plus `projectObservationToV1Inspection(result): AgentInspection`.

The existing `inspectRegisteredAgents` and `resolveAgentInspection` exports remain on the legacy implementation for mutation and execution consumers. Add an import/route boundary test that fails if this milestone rewires ensure/install/run/update or removes those exports; only the six read-only commands consume the new service.

- [ ] **Step 1: Add failing service tests for aliases, ordering, and unknown agents**

  Assert canonical registry order, alias resolution, one observation per agent, no provider/state mutation, and unchanged legacy service exports for non-read-only callers.

- [ ] **Step 2: Add failing compatibility projection tests**

  Lock current meanings of `inPath`, `binaryPath`, `resolvedBinaryPath`, `installedVersion`, `latestVersion`, `lifecycle`, `sourceLabel`, and `updateLabel` across tracked, untracked, ghost, conflicting, and indeterminate internal observations.

- [ ] **Step 3: Implement the application service and one-way compatibility adapter**

  Domain/application code must not import output envelopes or presenters. The compatibility adapter may reuse current label helpers but must omit new drift/capability fields from v1 objects.

- [ ] **Step 4: Run focused tests and checkpoint**

  Run:

  ```bash
  bun run test -- test/services/lifecycle-observations.test.ts test/compatibility/agent-inspection.test.ts test/commands/list.test.ts test/commands/info.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `feat(observation): add read-only application boundary`
