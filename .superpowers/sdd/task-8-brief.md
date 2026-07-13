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
