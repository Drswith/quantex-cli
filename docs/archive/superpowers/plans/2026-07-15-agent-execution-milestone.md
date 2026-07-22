# Agent Execution Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete OpenSpec tasks 8.1–8.4 by routing explicit `exec` and shortcut launches through one observation-driven execution use case while preserving every v1 install-policy, standard-I/O, exit-code, timeout, and cancellation contract.

**Architecture:** Add a pure execution-preflight planner over live lifecycle observations, then coordinate observation, optional verified installation, re-observation, and child launch in an injected application service. Keep `src/commands/run.ts` and `src/cli.ts` as compatibility adapters and presenters. A narrow production process port retains the existing terminal and process-tree behavior without moving command parsing or human output into the lifecycle domain.

**Tech Stack:** Bun 1.3.x, strict TypeScript, Commander 14, Vitest, existing lifecycle observation/install reconciliation, existing child-process infrastructure, OpenSpec.

## Global Constraints

- Preserve explicit `exec <agent>` syntax, passthrough arguments, and default `--install never`; preserve shortcut launch with its current prompt policy.
- Preserve `never`, `if-missing`, `always`, and shortcut `prompt` behavior. For compatibility, `always` does not reinstall an already runnable agent.
- An executable present in `PATH` remains runnable even when provider or receipt evidence has drift; installation reconciliation remains responsible for deciding whether an absent executable can be installed safely.
- Execution preflight MUST use live lifecycle observation without resolving a remote latest version or introducing an implicit self-update/network request.
- Human launches inherit stdin/stdout/stderr. Structured explicit `exec` keeps stdout reserved for Quantex protocol output and routes child output to stderr. Shortcut structured output remains rejected before launch.
- Return the child agent's exact exit code when it exits normally. Preserve exit code `10` for timeout, `11` for cancellation, existing preflight/error mappings, and exit code `1` for install/launch failure.
- Timeout and cancellation MUST terminate the managed process tree on Unix and Windows-capable paths and MUST clean up signal handlers after every outcome.
- Reuse verified installation reconciliation; do not invoke `ensure` or `install` as a nested CLI command and do not duplicate receipt persistence in the execution service.
- Do not implement Phase 3 command-registry generation, Phase 9 self-upgrade integration, Phase 10 compatibility-facade removal, or any workflow-orchestration feature in this milestone.
- Keep `redesign-lifecycle-engine` active. Check only tasks 8.1–8.4 after their full wording is implemented and verified; do not sync current specs or archive either active change.
- Create granular recovery commits, retain them on a recovery ref, and normalize the PR branch to one commit before delivery to `codex/redesign-lifecycle-integration`.

---

### Task 1: Pure Execution Preflight Planning

**Files:**
- Create: `src/lifecycle/agent-execution.ts`
- Modify: `src/lifecycle/index.ts`
- Test: `test/lifecycle/agent-execution.test.ts`

**Interfaces:**
- Consumes: `LifecycleObservation`, `AgentExecutableObservation`, install policy, interaction state, and dry-run state.
- Produces: `AgentExecutionPreflightInput`, `AgentExecutionPreflightPlan`, and `planAgentExecutionPreflight(input)`.
- `AgentExecutionPreflightPlan` decisions are exactly `launch`, `install-and-launch`, `prompt-install`, `dry-run`, or `reject`; rejected plans carry `AGENT_NOT_INSTALLED` or `INTERACTION_REQUIRED` without CLI-formatted text.

- [ ] **Step 1: Add failing table-driven preflight tests**

  Cover executable present with every policy, executable absent with `never`, `if-missing`, `always`, interactive `prompt`, non-interactive `prompt`, and dry run. Add provider-drift and indeterminate-provider observations with an executable still present and assert they remain launchable. Assert repeated planning returns deep-equal plans and does not mutate the input.

- [ ] **Step 2: Run the planner test to verify RED**

  Run: `bun run test -- test/lifecycle/agent-execution.test.ts`

  Expected: FAIL because `planAgentExecutionPreflight` and its typed decisions do not exist.

- [ ] **Step 3: Implement the minimal pure decision table**

  Implement this decision order without I/O:

  ```typescript
  export function planAgentExecutionPreflight(input: AgentExecutionPreflightInput): AgentExecutionPreflightPlan {
    if (input.executable.present) return { decision: input.dryRun ? 'dry-run' : 'launch' }
    if (input.installPolicy === 'never') {
      return { decision: 'reject', errorCode: 'AGENT_NOT_INSTALLED' }
    }
    if (input.installPolicy === 'prompt' && !input.interactive) {
      return { decision: 'reject', errorCode: 'INTERACTION_REQUIRED' }
    }
    if (input.dryRun) return { decision: 'dry-run' }
    return { decision: input.installPolicy === 'prompt' ? 'prompt-install' : 'install-and-launch' }
  }
  ```

  The concrete types may carry the observation and normalized intent for later diagnostics, but MUST NOT import command presenters, Commander, prompts, state stores, providers, or process utilities.

- [ ] **Step 4: Verify GREEN and domain isolation**

  Run: `bun run test -- test/lifecycle/agent-execution.test.ts && bun run typecheck`

  Expected: PASS; `src/lifecycle/agent-execution.ts` has no CLI or infrastructure imports.

- [ ] **Step 5: Review and checkpoint**

  Review decision completeness and v1 policy compatibility, then commit:

  ```bash
  git add src/lifecycle/agent-execution.ts src/lifecycle/index.ts test/lifecycle/agent-execution.test.ts
  git commit -m "refactor(exec): add lifecycle preflight planning"
  ```

### Task 2: Observation-Driven Execution Application Service

**Files:**
- Create: `src/services/lifecycle-execution.ts`
- Modify: `src/services/index.ts`
- Test: `test/services/lifecycle-execution.test.ts`

**Interfaces:**
- Produces `LifecycleExecutionServicePorts` with injected `observe`, `install`, `confirmInstall`, and `launch` functions plus interaction, dry-run, signal, timeout, and output-mode values.
- Produces `executeAgentLifecycle(input, ports): Promise<AgentExecutionOutcome>`.
- `AgentExecutionOutcome` is a discriminated union for `not-found`, `not-installed`, `interaction-required`, `install-declined`, `install-failed`, `dry-run`, `launch-failed`, `cancelled`, `timed-out`, and `exited`.
- The service passes a canonical launch request containing `[binaryName, ...args]`, selected stdio mode, the invocation signal, and timeout. It returns typed data only and never prints or calls `process.exit`.

- [ ] **Step 1: Add failing application-service tests**

  Cover unknown agents, installed launch, every install policy, declined prompt, verified install followed by launch, install success followed by absent re-observation, dry run, launch failure, child exit codes `0`, `2`, and `42`, cancellation, and timeout. Assert launch never occurs before a post-install observation reports the executable present.

- [ ] **Step 2: Run service tests to verify RED**

  Run: `bun run test -- test/services/lifecycle-execution.test.ts`

  Expected: FAIL because the execution application service does not exist.

- [ ] **Step 3: Implement plan/execute orchestration**

  Resolve one live observation, call `planAgentExecutionPreflight`, request confirmation only for `prompt-install`, and invoke the injected verified-install port only for an accepted install decision. Re-observe after successful installation and reject launch if the executable is still absent. Do not resolve latest versions, persist receipts, or select providers inside this service.

- [ ] **Step 4: Implement typed launch mapping**

  Map process-port success with a numeric exit code to `exited`, null exit plus a termination signal to `launch-failed`, and runtime failure kinds `cancelled`/`timed-out` to their matching execution outcomes. Preserve any other typed runtime failure as `launch-failed` with its stable diagnostic fields.

- [ ] **Step 5: Verify GREEN and service boundaries**

  Run: `bun run test -- test/services/lifecycle-execution.test.ts test/lifecycle/agent-execution.test.ts && bun run typecheck`

  Expected: PASS; the service imports lifecycle/runtime types but no concrete catalog, provider, state, prompts, child-process, or presenter module.

- [ ] **Step 6: Review and checkpoint**

  Review ordering, no-launch-on-unverified-install, cancellation mapping, and boundary purity, then commit:

  ```bash
  git add src/services/lifecycle-execution.ts src/services/index.ts test/services/lifecycle-execution.test.ts
  git commit -m "refactor(exec): add lifecycle execution service"
  ```

### Task 3: Production Process Port and Unified `exec`/Shortcut Surface

**Files:**
- Create: `src/runtime/agent-process.ts`
- Modify: `src/runtime/index.ts`
- Create: `src/services/lifecycle-execution-production.ts`
- Modify: `src/services/lifecycle-observations.ts`
- Modify: `src/commands/run.ts`
- Create: `src/commands/shortcut.ts`
- Modify: `src/cli.ts`
- Test: `test/runtime/agent-process.test.ts`
- Test: `test/commands/shortcut.test.ts`
- Modify: `test/commands/run.test.ts`
- Modify: `test/services/lifecycle-observations.test.ts`

**Interfaces:**
- `createAgentProcessPort()` implements the execution service's launch port with existing `spawnCommand` and `terminateProcessTree` primitives while owning timeout, abort-listener, output draining, and listener cleanup.
- `createProductionLifecycleExecutionService()` binds catalog lookup, a no-latest-version lifecycle observation, verified `reconcileAgentInstallation`, prompts, and the process port.
- `resolveShortcutInvocation(argv, knownCommands, { agentFriendly })` is a pure compatibility parser exported from `src/commands/shortcut.ts`.
- `runCommand` becomes a v1 presenter over `AgentExecutionOutcome`; explicit `exec` and shortcut routing both call this same function.

- [ ] **Step 1: Add failing production process tests**

  Using controlled spawn handles, assert inherited stdio for human mode, ignored stdin plus child stdout/stderr forwarding to stderr for structured mode, exact child exit propagation, spawn failure, timeout termination, abort termination, Unix detached process-group termination, Windows tree-termination delegation, and cleanup of abort/signal listeners.

- [ ] **Step 2: Add failing shortcut parser and shared-route tests**

  Cover all currently accepted shortcut globals, passthrough argument order, known-command exclusion, unknown leading option fallback, missing global option values, structured/agent-friendly rejection, and the fact that both explicit `exec` and shortcut call the same `runCommand` compatibility adapter with their distinct default policies.

- [ ] **Step 3: Run the focused surface tests to verify RED**

  Run: `bun run test -- test/runtime/agent-process.test.ts test/commands/shortcut.test.ts test/commands/run.test.ts test/services/lifecycle-observations.test.ts`

  Expected: FAIL because the process port, pure shortcut parser, no-latest execution observation, and production composition root do not exist.

- [ ] **Step 4: Implement the process port**

  Spawn direct argv with `detached: true` on non-Windows platforms. Register one abort listener before awaiting the child, race the child with timeout when configured, terminate the entire managed process tree on abort/timeout, await output drains, and remove every listener/timer in `finally`. Never translate a normal non-zero child exit into a Quantex failure.

- [ ] **Step 5: Add a no-network execution observation composition**

  Extend `createProductionLifecycleObservationService` with an explicit option that disables latest-version resolution while preserving its current default. Bind execution preflight with that option and assert the latest-version/network port is not called. Do not change read-only command behavior.

- [ ] **Step 6: Bind verified installation and process launch**

  The production installation port may adapt the already migrated `reconcileAgentInstallation` path after preflight chooses installation. It MUST use the reconciler's verified result, then let the application service re-observe before launch. It MUST NOT call `installAgent` directly from `runCommand` or write lifecycle receipts itself.

- [ ] **Step 7: Convert `runCommand` into a compatibility presenter**

  Map typed outcomes to the existing human text, JSON v1 data/error fields, install guidance, and established exit codes. Retain explicit `exec` default `never`, shortcut default `prompt`, passthrough argument handling, dry-run messages, and prompt copy. Remove legacy timeout/signal/install policy control flow from the command after equivalent tests pass.

- [ ] **Step 8: Extract and route the shortcut parser**

  Move `ShortcutInvocation` and `resolveShortcutInvocation` out of `src/cli.ts`. Pass TTY-derived `agentFriendly` as input, keep structured shortcut rejection unchanged, and call the same `runCommand` facade used by explicit `exec`.

- [ ] **Step 9: Verify GREEN and v1 compatibility**

  Run: `bun run test -- test/runtime/agent-process.test.ts test/commands/shortcut.test.ts test/commands/run.test.ts test/commands/state-read-error.test.ts test/compatibility/v1-baseline.test.ts test/services/lifecycle-observations.test.ts`

  Expected: PASS with exact child exit codes, stream routing, preflight errors, dry-run output, and existing v1 fixtures unchanged.

- [ ] **Step 10: Review and checkpoint**

  Review stdio ownership, signal races, process-tree cleanup, no-network preflight, and compatibility mapping, then commit:

  ```bash
  git add src/runtime/agent-process.ts src/runtime/index.ts src/services/lifecycle-execution-production.ts src/services/lifecycle-observations.ts src/commands/run.ts src/commands/shortcut.ts src/cli.ts test/runtime/agent-process.test.ts test/commands/shortcut.test.ts test/commands/run.test.ts test/services/lifecycle-observations.test.ts
  git commit -m "refactor(exec): unify explicit and shortcut execution"
  ```

### Task 4: Cross-Platform Execution and Cancellation Verification

**Files:**
- Modify: `scripts/lifecycle-smoke.ts`
- Modify: `test/managed-installer-cancellation.e2e.test.ts`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`
- Replace: `.superpowers/sdd/progress.md`

**Interfaces:**
- The lifecycle smoke runs an installed sandbox agent through explicit `exec -- --version` and shortcut `<agent> --version`, in addition to the existing exec dry run.
- Cross-platform tests exercise the same production process/cancellation adapter used by the command surface.

- [ ] **Step 1: Add failing smoke assertions for real execution**

  After the managed sandbox agent is installed and verified, run explicit exec and shortcut version commands. Assert exit code `0`, non-empty version output on the expected terminal stream, and no mutation of lifecycle receipts during execution.

- [ ] **Step 2: Harden managed-installer cancellation coverage**

  Keep the existing natural-completion deadline and add assertions that cancellation leaves no successful receipt, no running child process, and no later state write. Use platform-specific path delimiters and process termination behavior so the test runs under Windows CI as well as Unix.

- [ ] **Step 3: Run focused and cross-platform-capable local suites**

  Run: `bun run test -- test/lifecycle/agent-execution.test.ts test/services/lifecycle-execution.test.ts test/runtime/agent-process.test.ts test/commands/shortcut.test.ts test/commands/run.test.ts test/managed-installer-cancellation.e2e.test.ts`

  Expected: PASS with no leaked processes or timers.

- [ ] **Step 4: Run trusted container execution smoke**

  Run: `QTX_ISOLATION_AGENTS=codex QTX_ISOLATION_SCENARIOS=managed,deno-managed,uv-managed bun run test:container`

  Expected: PASS including explicit exec, shortcut execution, and existing install/ensure/update/uninstall lifecycle scenarios.

- [ ] **Step 5: Complete OpenSpec task accounting**

  Check tasks 8.1–8.4 only after focused, full, three-platform CI, and sandbox evidence exists. Update progress to record exact commit/test evidence. The active count becomes 48/74; the change remains active and unarchived.

- [ ] **Step 6: Run the complete milestone gate**

  Run:

  ```bash
  bun run lint
  bun run format:check
  bun run typecheck
  bun run test
  bun run openspec:validate
  bun run memory:check
  bun run build
  ```

  Expected: all commands pass; no release artifact or npm publication is produced.

- [ ] **Step 7: Whole-branch review and recovery checkpoint**

  Request independent spec and code-quality review over `origin/codex/redesign-lifecycle-integration...HEAD`, fix every Critical/Important finding, rerun affected gates, then commit:

  ```bash
  git add scripts/lifecycle-smoke.ts test/managed-installer-cancellation.e2e.test.ts openspec/changes/redesign-lifecycle-engine/tasks.md .superpowers/sdd/progress.md
  git commit -m "test(exec): verify cross-platform lifecycle execution"
  git update-ref refs/quantex/recovery/redesign-agent-execution-granular HEAD
  ```

### Task 5: PR Delivery to Integration

**Files:**
- Modify as needed: `.superpowers/sdd/progress.md`
- Create outside the repository: `/tmp/quantex-agent-execution-pr.md`

**Interfaces:**
- Produces one reviewed milestone commit and one ready PR from `codex/redesign-agent-execution` to `codex/redesign-lifecycle-integration`.
- Preserves granular recovery history under `refs/quantex/recovery/redesign-agent-execution-granular`.

- [ ] **Step 1: Refresh integration and normalize with CAS**

  Fetch both refs, require the approved integration tip to remain the milestone base or rebase/revalidate first, preserve the granular head under the recovery ref, and normalize the feature branch to one commit with title:

  ```text
  refactor: migrate agent execution lifecycle
  ```

- [ ] **Step 2: Re-run final-tree validation**

  Repeat lint, format check, typecheck, full test, OpenSpec validation, memory check, build, and trusted container smoke on the normalized tree. Verify the normalized tree hash equals the reviewed granular tree hash.

- [ ] **Step 3: Validate the PR body**

  Build the body from `.github/pull_request_template.md`, record OpenSpec `48/74`, local/container evidence, compatibility impact, release state, and archive state, then run:

  ```bash
  bun run pr:body:check -- --body-file /tmp/quantex-agent-execution-pr.md --title "refactor: migrate agent execution lifecycle"
  ```

- [ ] **Step 4: Push and create the ready PR**

  Push `codex/redesign-agent-execution`, create a ready PR with base `codex/redesign-lifecycle-integration`, and confirm `autoMergeRequest` is null.

- [ ] **Step 5: Monitor required and review checks**

  Require lint, format/typecheck, macOS/Ubuntu/Windows tests, OpenSpec, memory, sandbox tests, PR body validation, and independent governance review to pass. Confirm no Release workflow runs for the branch or PR.

- [ ] **Step 6: Rebase-merge only after final CAS**

  Persist approved base tip, feature head, and expected merge tree under the worktree Git path. Reload them in a fresh process, fetch both refs again, verify exact equality, and merge with:

  ```bash
  pr_number=$(gh pr view --json number --jq .number)
  approved_feature_head=$(git rev-parse origin/codex/redesign-agent-execution)
  gh pr merge "$pr_number" --rebase --match-head-commit "$approved_feature_head"
  ```

  Do not enable auto-merge, create a merge commit, or squash unless rebase is unavailable and the user explicitly authorizes the fallback.

- [ ] **Step 7: Verify post-merge closure**

  Fetch integration, require its tree to equal the approved expected tree, confirm it still contains latest `main`, confirm no release ran, and leave `redesign-lifecycle-engine` active at 48/74 with no spec sync or archive closure.
