### Task 1: Build the live agent lifecycle observer (OpenSpec 5.1)

**Files:**
- Create: `src/lifecycle/agent-observation.ts`
- Create: `test/lifecycle/agent-observation.test.ts`
- Modify: `src/lifecycle/model.ts`
- Modify: `src/lifecycle/index.ts`
- Modify: `src/lifecycle/provider-evidence.ts`

**Interfaces:**
- Consumes: `AgentDefinition`, `InstalledAgentState`, `LifecycleReceipt`, `ProviderRegistry`, `resolveStateProviderBinding`, `resolveReceiptProviderBinding`, `observeLifecycleProvider`.
- Produces: `observeAgentLifecycle(agent, ports): Promise<AgentLifecycleObservationResult>` where the result contains the domain `LifecycleObservation`, exact provider binding/capabilities when resolvable, executable/version facts, installed-state provenance, receipt, and normalized catalog methods.

- [ ] **Step 1: Write table-driven failing observation tests**

  Cover: absent/no evidence, live untracked executable, verified tracked state+receipt, legacy tracked state without receipt, conclusive ghost, state/receipt provider conflict, provider-present/PATH-absent conflict, provider-absent/PATH-present conflict, unsupported binding, and indeterminate provider outcome. For agents without state or receipt, explicitly cover one candidate provider present, multiple candidate providers present, and candidate probe failure while PATH is present. Assert provider id, target id/kind, capabilities, drift kind, version/path, and that no state mutator is called.

- [ ] **Step 2: Verify the tests fail for the missing observer**

  Run: `bun run test -- test/lifecycle/agent-observation.test.ts`

  Expected: FAIL because `observeAgentLifecycle` is not defined.

- [ ] **Step 3: Implement minimal injected observation ports**

  Define ports for clock, executable/path/version inspection, installed-state/receipt reads, provider registry, and provider observation. Use exact state/receipt bindings; compare provider id, target id, target kind, and executable identity. When no persisted binding exists, observe every catalog candidate: exactly one live candidate may establish provider ownership, multiple live candidates classify as `conflicting-source`, and any unresolved candidate probe that prevents a conclusive decision classifies as `indeterminate`. PATH presence alone never establishes provider ownership. Preserve typed provider outcomes rather than branching on messages.

- [ ] **Step 4: Make drift classification explicit and exhaustive**

  Use only `none`, `untracked`, `recorded-absent`, `conflicting-source`, and `indeterminate`. A present executable is not proof of provider ownership; a receipt is provenance, not live proof.

- [ ] **Step 5: Run the focused gate and checkpoint**

  Run:

  ```bash
  bun run test -- test/lifecycle/agent-observation.test.ts test/lifecycle/provider-evidence.test.ts test/state.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `feat(lifecycle): observe live agent evidence`
