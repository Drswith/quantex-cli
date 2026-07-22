# Observation and Read-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete OpenSpec `redesign-lifecycle-engine` tasks 5.1–5.7 by introducing one live lifecycle observation boundary and routing all read-only agent/provider commands through it without changing v1 output contracts.

**Architecture:** Add an application-level observer that combines catalog candidates, installed-state provenance, lifecycle receipts, executable/version evidence, exact provider observations, and registry-derived capabilities into the existing lifecycle domain model. Keep command result interfaces and human presenters as the v1 compatibility shell; commands consume an explicit compatibility projection rather than rebuilding lifecycle truth independently. The observer performs reads only, the planner remains pure, and provider availability is derived from the compile-time registry.

**Tech Stack:** Bun 1.3.x, strict TypeScript, Vitest, OpenSpec, existing provider/state/inspection/output modules, oxlint, and oxfmt.

## Global Constraints

- Scope is OpenSpec 5.1–5.7 only; update/idempotency, agent execution, self-upgrade, command-registry completion, legacy removal, release, and archive closure remain deferred.
- Preserve all v1 JSON/NDJSON field names, requiredness, error codes, exit mapping, stdout/stderr behavior, install guidance, package/binary names, and maintained root exports.
- Do not add lifecycle/drift/provider metadata to strict v1 projections; keep richer evidence internal until a negotiated protocol version exists.
- Read-only commands perform no state, receipt, provider, or lifecycle-lock mutation.
- Keep the legacy `inspectRegisteredAgents` and `resolveAgentInspection` exports and semantics intact for ensure/install/run/update and other mutation/execution callers; only `list`, `info`, `inspect`, `resolve`, `capabilities`, and `doctor` may route through the new observation service in this milestone.
- Provider failure or contradictory evidence fails closed as `indeterminate` or `conflicting-source`; persisted state never overrides the live environment.
- `doctor` may retain its explicitly declared network checks; this milestone must not add fresh network effects to other commands.
- Work in `/Users/drs/.codex/worktrees/quantex-observation-readonly` on `codex/redesign-observation-readonly`, based on latest `codex/redesign-lifecycle-integration`.
- Keep recoverable checkpoint commits. Before PR delivery, retain checkpoint refs, normalize to one reviewed commit, and target `codex/redesign-lifecycle-integration`; rebase merge preferred, squash fallback, no merge commit or auto-merge.

---

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

### Task 2: Complete deterministic planning over observation states (OpenSpec 5.2)

**Files:**
- Modify: `src/lifecycle/mutation-planner.ts`
- Modify: `src/lifecycle/model.ts`
- Modify: `test/lifecycle/mutation-planner.test.ts`
- Create: `test/lifecycle/observation-planning.test.ts`

**Interfaces:**
- Consumes: `LifecycleObservation`, requested `LifecycleIntent`, exact provider binding, and registry-derived capabilities.
- Produces: deterministic `LifecycleMutationPlanningResult` with decisions for satisfied, install, adopt, preserve-unmanaged, clear-ghost, uninstall, unsupported, and blocked.

- [ ] **Step 1: Add failing planner matrix tests**

  Use one row for every required state: already-satisfied, absent, tracked, untracked, ghost, conflicting, unsupported, and indeterminate. Repeat each row to prove stable plan ids, step ordering, effects, and postconditions.

- [ ] **Step 2: Verify unsupported and contradictory rows fail**

  Run: `bun run test -- test/lifecycle/mutation-planner.test.ts test/lifecycle/observation-planning.test.ts`

  Expected: FAIL until capability-aware decisions exist.

- [ ] **Step 3: Extend the pure planner only**

  Add no filesystem, process, provider, console, output-envelope, or Commander imports. An absent required provider capability returns `unsupported`; conflicting/indeterminate observations return `blocked`; read-only callers may consume the plan without executing it.

- [ ] **Step 4: Run focused tests and checkpoint**

  Run:

  ```bash
  bun run test -- test/lifecycle/mutation-planner.test.ts test/lifecycle/observation-planning.test.ts test/lifecycle/shadow-planning.test.ts test/commands/ensure.test.ts test/commands/install.test.ts test/commands/uninstall.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(lifecycle): plan from live observations`

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

### Task 6: Derive capabilities and doctor diagnostics from registries (OpenSpec 5.5–5.6)

**Files:**
- Create: `src/services/provider-observations.ts`
- Create: `test/services/provider-observations.test.ts`
- Modify: `src/commands/capabilities.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `test/commands/capabilities.test.ts`
- Modify: `test/commands/doctor.test.ts`

**Interfaces:**
- Consumes: `firstPartyProviderRegistry.list()`, `getCapabilities(id)`, provider `availability`, agent observations, and existing explicitly network-aware self inspection.
- Produces: a typed provider availability/capability snapshot projected into the unchanged nine v1 installer fields and current doctor issue model.

- [ ] **Step 1: Add provider snapshot tests**

  Prove each registry adapter is queried once, capabilities come from implemented operations, cancellation/timeout/unavailable outcomes stay typed, and script/binary providers are not added to the strict v1 `installers` projection.

- [ ] **Step 2: Add command route tests**

  Make direct `isBunAvailable`/`isNpmAvailable`/etc. calls fail if used. Assert unchanged platform reasons, feature fields, self-upgrade projection, doctor installer booleans, issue codes, blocking flags, remediation commands, and explicitly network-aware self checks.

- [ ] **Step 3: Route capabilities and doctor through shared snapshots**

  Preserve exact v1 fields. Do not infer provider capabilities from duplicated command tables. Doctor agent issues consume live drift classifications but continue to emit only established issue/result fields.

- [ ] **Step 4: Run focused gates and checkpoint**

  Run:

  ```bash
  bun run test -- test/services/provider-observations.test.ts test/commands/capabilities.test.ts test/commands/doctor.test.ts test/providers/conformance.test.ts
  bun run format:check
  bun run lint
  bun run typecheck
  ```

  Commit: `refactor(readonly): derive capabilities and diagnostics`

### Task 7: Real-environment comparison and milestone closure (OpenSpec 5.7)

**Files:**
- Create: `scripts/read-only-lifecycle-smoke.ts`
- Create: `test/read-only-lifecycle-smoke.test.ts`
- Modify: `package.json`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Interfaces:**
- Consumes: the six migrated commands through the real CLI in a temporary HOME and the existing compatibility fixtures.
- Produces: deterministic local/container smoke evidence without mutating agent/provider state.

- [ ] **Step 1: Add a smoke harness test**

  Run `list`, `info`, `inspect`, `resolve`, `capabilities`, and `doctor` in human and JSON modes against absent, tracked, untracked, and ghost fixtures. Assert parseable structured stdout, expected stable fields/error codes, no state-file byte changes, and no install/update/uninstall process invocation.

- [ ] **Step 2: Run the harness locally and in Bun container**

  Run:

  ```bash
  bun run test:readonly-smoke
  docker run --rm -v "$PWD:/mnt/quantex-cli:ro" oven/bun:1.3.11 sh -lc 'mkdir /tmp/quantex-work && cd /mnt/quantex-cli && tar --exclude=.git --exclude=node_modules --exclude=dist -cf - . | tar -xf - -C /tmp/quantex-work && cd /tmp/quantex-work && bun install --frozen-lockfile && bun run test:readonly-smoke'
  ```

  Expected: both environments pass; host-dependent availability/version values are normalized rather than golden-locked.

- [ ] **Step 3: Run the complete milestone gate**

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

- [ ] **Step 4: Mark only OpenSpec 5.1–5.7 complete**

  Confirm `bun run openspec:list` reports 37/74. Keep `redesign-lifecycle-engine` active and do not sync current specs or archive.

  Commit: `test(readonly): verify observation migration`

### Task 8: Review, normalize, push, and PR to integration

**Files:**
- Create ignored PR body: `.tmp/observation-readonly-pr-body.md`

**Interfaces:**
- Consumes: reviewed milestone tree and latest remote integration head.
- Produces: one-commit PR `codex/redesign-observation-readonly` → `codex/redesign-lifecycle-integration`.

- [ ] **Step 1: Request independent review**

  Review observation correctness, provider/receipt conflict handling, pure planner behavior, read-only/no-lock/no-write guarantees, v1 projection compatibility, network effects, and real-environment evidence. Resolve every blocker/important finding with TDD.

- [ ] **Step 2: Re-fetch and rebase if integration advanced**

  Compare `merge-base` with `origin/codex/redesign-lifecycle-integration`. Rebase onto latest integration if needed and rerun the full gate.

- [ ] **Step 3: Preserve checkpoints and normalize**

  Retain granular history on `codex/redesign-observation-readonly-checkpoints`, then normalize the delivery branch to one commit:

  ```text
  refactor: migrate lifecycle observations and read-only commands
  ```

  Verify the pre/post normalization tree ids match.

- [ ] **Step 4: Validate and create the PR**

  Build the body from `.github/pull_request_template.md`, run:

  ```bash
  bun run pr:body:check -- --body-file .tmp/observation-readonly-pr-body.md --title "refactor: migrate lifecycle observations and read-only commands"
  ```

  Push and create a ready PR with base `codex/redesign-lifecycle-integration`.

- [ ] **Step 5: Verify remote closure**

  Require CI, Sandbox Tests when classified, OpenSpec, memory, and governance checks to pass. Confirm no Release workflow/npm publication. After review, rebase-merge with expected-head protection; use squash only if rebase is unavailable/unsafe. Verify the merged integration tree equals the reviewed tree and keep OpenSpec active.

## Self-Review

- Spec coverage: Tasks 1–7 map exactly to OpenSpec 5.1–5.7; Task 8 owns the required milestone delivery closure.
- Scope: no update/idempotency, execution, self-upgrade, schema-v2 output, dynamic providers, workflow orchestration, release, or archive work is included.
- Compatibility: every command migration retains its existing result interface/presenter and uses an explicit v1 projection.
- Failure safety: provider/receipt conflicts and unavailable probes remain internal drift/indeterminate evidence; read-only commands never repair state.
- Type consistency: `AgentLifecycleObservationResult`, `resolveAgentObservation`, `observeRegisteredAgents`, `projectObservationToV1Inspection`, and provider snapshot interfaces are defined before command consumers.
- Placeholder scan: no unresolved placeholder markers remain.
