# Lifecycle Engine Phase 0/1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task by task, with `superpowers:test-driven-development` for every behavior change.

**Goal:** Establish the compatibility guardrails and dependency-free runtime/domain foundations needed to rebuild Quantex behind its existing v1 CLI and package surface.

**Architecture:** Keep the current CLI and public package exports as a compatibility shell. Add an internal, per-invocation runtime context, a CLI-independent lifecycle model, pure plan validation, and a command-contract registry whose v1 projection drives command discovery. Do not migrate provider execution, catalog entries, mutation handlers, state storage, Commander registration, or presenters in this milestone.

**Tech Stack:** Bun 1.3, TypeScript 5.9, Vitest 4, Commander 14, OpenSpec.

## Scope and completion boundary

This plan implements the first safe slice of `redesign-lifecycle-engine`:

- a machine-checked v1 compatibility manifest for package names, binary names, stable commands, error codes, state fixtures, and maintained root exports;
- exact command-to-schema parity for all 15 stable commands;
- isolated invocation state and typed runtime ports;
- CLI-independent lifecycle types and deterministic plan validation;
- a command-contract registry that becomes the sole source for `commands --json`.

The following remain explicitly out of scope and must keep their OpenSpec tasks unchecked: provider/catalog migration, typed provider outcomes in existing handlers, Commander generation, shortcut normalization, presenter migration, lifecycle reconciliation, state migration, idempotency redesign, self-upgrade integration, and legacy removal.

## Global constraints

- Preserve `quantex-cli`, the `quantex` alias contract, both `qtx` and `quantex` binaries, v1 command names, flags, schema references, error codes, output envelopes, exit mapping, state readability, and maintained root exports.
- Do not read, copy, cherry-pick, or otherwise depend on the pending refactor PR, its worktree, or Codex session `019f44f7-735b-79b3-83a1-1fd4d4da5334`.
- New runtime and lifecycle modules stay internal; do not add them to `src/index.ts` in this milestone.
- Every test must fail for the intended reason before production code is added.
- Update OpenSpec checkboxes only when the literal task statement is fully satisfied.
- After every implementation commit run at least the focused tests plus `bun run lint`, `bun run format:check`, and `bun run typecheck`.

---

## Task 1: Lock the v1 compatibility baseline

**Files:**

- Create: `test/fixtures/compatibility/v1/surface.json`
- Create: `test/fixtures/compatibility/v1/root-exports.json`
- Create: `test/fixtures/compatibility/v1/state/valid.json`
- Create: `test/fixtures/compatibility/v1/state/ghost.json`
- Create: `test/fixtures/compatibility/v1/state/untracked.json`
- Create: `test/fixtures/compatibility/v1/state/corrupt.txt`
- Create: `test/compatibility/v1-baseline.test.ts`
- Modify: `openspec/changes/redesign-lifecycle-engine/design.md`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Step 1: Write the failing compatibility test**

Add a fixture loader and assertions that compare live source truth with the checked-in manifest:

```ts
const surface = await readFixture<CompatibilitySurface>('surface.json')

expect(packageJson.name).toBe(surface.packageName)
expect(Object.keys(packageJson.bin).sort()).toEqual(surface.binaryNames)
expect(cliErrorCodes).toEqual(surface.errorCodes)
expect((await commandsCommand()).data?.commands.map(command => command.name)).toEqual(surface.commands)
expect(Object.keys(await import('../../src/index')).sort()).toEqual(rootExports)
```

Use temporary `HOME` directories to prove `loadState()` accepts the valid and ghost fixtures, represents an untracked agent by absence from state, and rejects the corrupt fixture with the existing `STATE_READ_ERROR` behavior.

Run:

```bash
bun run test -- test/compatibility/v1-baseline.test.ts
```

Expected: fail because fixtures and assertions do not exist.

**Step 2: Add the golden fixtures**

Capture only stable contractual fields:

```json
{
  "schemaVersion": "1",
  "packageName": "quantex-cli",
  "binaryNames": ["qtx", "quantex"],
  "commands": ["capabilities", "commands", "config", "doctor", "exec", "ensure", "info", "inspect", "install", "list", "resolve", "schema", "update", "uninstall", "upgrade"],
  "errorCodes": ["AGENT_NOT_FOUND", "AGENT_NOT_INSTALLED", "CANCELLED", "INSTALL_FAILED", "INTERACTION_REQUIRED", "INVALID_ARGUMENT", "MANUAL_ACTION_REQUIRED", "NETWORK_ERROR", "RESOURCE_LOCKED", "STATE_READ_ERROR", "TIMEOUT", "UNINSTALL_FAILED", "UNINSTALL_UNMANAGED", "UPDATE_FAILED", "UPGRADE_FAILED"]
}
```

Keep timestamps, paths, colors, spacing, host capability values, network results, and free-form diagnostic prose out of hard fixtures.

**Step 3: Document fixture policy**

Add a `Compatibility fixture policy` subsection to the active change design. Classify package/binary names, machine-readable fields, error codes, command names, schema references, state interpretation, and root exports as hard contracts. Classify ANSI styling, whitespace, timing, host-dependent values, and free-form human prose as non-contractual unless promoted by a later spec.

**Step 4: Verify and update OpenSpec**

Run:

```bash
bun run test -- test/compatibility/v1-baseline.test.ts
bun run lint
bun run format:check
bun run typecheck
```

Mark OpenSpec tasks `1.5` and `1.6` complete. Leave `1.1` incomplete because exhaustive human/JSON/NDJSON command-family goldens are not delivered by this slice.

**Step 5: Commit**

```bash
git add test/fixtures/compatibility/v1 test/compatibility/v1-baseline.test.ts openspec/changes/redesign-lifecycle-engine/design.md openspec/changes/redesign-lifecycle-engine/tasks.md
git commit -m "test(compat): lock v1 lifecycle baseline"
```

---

## Task 2: Introduce isolated invocation runtime ports

**Files:**

- Create: `src/runtime/ports.ts`
- Create: `src/runtime/invocation-context.ts`
- Create: `src/runtime/index.ts`
- Create: `test/runtime/invocation-context.test.ts`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Step 1: Write failing isolation tests**

Create two contexts with different `dryRun`, `quiet`, `cacheMode`, `outputMode`, timeout, and fake port instances. Register separate cancellation handlers, cancel one context, and assert that the other context and handler remain untouched.

```ts
const first = createInvocationContext({ dryRun: true, outputMode: 'json', ports: firstPorts })
const second = createInvocationContext({ quiet: true, outputMode: 'ndjson', ports: secondPorts })

first.onCancel(firstHandler)
second.onCancel(secondHandler)
await first.cancel('test')

expect(first.signal.aborted).toBe(true)
expect(second.signal.aborted).toBe(false)
expect(firstHandler).toHaveBeenCalledOnce()
expect(secondHandler).not.toHaveBeenCalled()
```

Run:

```bash
bun run test -- test/runtime/invocation-context.test.ts
```

Expected: fail because the runtime modules do not exist.

**Step 2: Define runtime ports**

Create narrow dependency interfaces for:

```ts
export interface RuntimePorts {
  cache: CachePort
  clock: ClockPort
  fileSystem: FileSystemPort
  locks: LockPort
  network: NetworkPort
  persistence: PersistencePort
  process: ProcessPort
}
```

The interfaces must carry values and typed outcomes, not import Commander, console rendering, the global `CliContext`, or concrete provider implementations. Include cancellation signals on operations that can block.

**Step 3: Implement per-invocation context**

`createInvocationContext()` owns its own `AbortController`, cancellation-handler set, runtime options, and ports. Expose read-only options plus `signal`, `onCancel(handler)`, and idempotent `cancel(reason?)`. Do not mutate or bridge the legacy singleton yet.

**Step 4: Verify and update OpenSpec**

Run:

```bash
bun run test -- test/runtime/invocation-context.test.ts
bun run lint
bun run format:check
bun run typecheck
```

Mark tasks `2.1` and `2.5` complete only if all listed ports and isolation dimensions are covered.

**Step 5: Commit**

```bash
git add src/runtime test/runtime openspec/changes/redesign-lifecycle-engine/tasks.md
git commit -m "feat(runtime): add isolated invocation context"
```

---

## Task 3: Define the lifecycle domain and pure plan validation

**Files:**

- Create: `src/lifecycle/model.ts`
- Create: `src/lifecycle/plan-validation.ts`
- Create: `src/lifecycle/index.ts`
- Create: `test/lifecycle/plan-validation.test.ts`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Step 1: Write failing validator tests**

Cover a valid ordered plan and deterministic failures for:

- duplicate step IDs;
- dependencies that are missing or appear after their consumer;
- effects not declared by the selected provider capability set;
- mutating steps without postconditions;
- compensation references that do not resolve or are not ordered before use.

```ts
expect(validateLifecyclePlan(plan, capabilities)).toEqual([
  { code: 'MISSING_CAPABILITY', stepId: 'install', value: 'package-install' },
  { code: 'MISSING_POSTCONDITION', stepId: 'install' },
])
```

Run:

```bash
bun run test -- test/lifecycle/plan-validation.test.ts
```

Expected: fail because lifecycle types and validation do not exist.

**Step 2: Add CLI-independent lifecycle types**

Define discriminated, immutable models for `LifecycleIntent`, `LifecycleObservation`, `LifecycleDrift`, `LifecyclePlan`, `LifecycleStep`, `LifecycleEffect`, `ProviderCapability`, `LifecyclePostcondition`, `LifecycleVerification`, `LifecycleReceipt`, and `LifecycleOutcome<T>`. Outcomes must distinguish success, unsupported, failed, cancelled, timed-out, and indeterminate states without using CLI error codes.

**Step 3: Implement deterministic validation**

`validateLifecyclePlan(plan, capabilities)` must be pure, return all issues in step order, never inspect the host, and never throw for an invalid user/provider plan. Use a closed `PlanValidationIssueCode` union so later compatibility mapping can be exhaustive.

**Step 4: Verify and update OpenSpec**

Run:

```bash
bun run test -- test/lifecycle/plan-validation.test.ts
bun run lint
bun run format:check
bun run typecheck
```

Mark tasks `2.2` and `2.3` complete. Leave `2.4` incomplete because existing provider and command handlers still return legacy booleans/results.

**Step 5: Commit**

```bash
git add src/lifecycle test/lifecycle openspec/changes/redesign-lifecycle-engine/tasks.md
git commit -m "feat(lifecycle): add typed plan foundation"
```

---

## Task 4: Make command discovery registry-driven and enforce schema parity

**Files:**

- Create: `src/command-contract/registry.ts`
- Create: `src/command-contract/index.ts`
- Create: `test/command-contract/registry.test.ts`
- Modify: `src/commands/commands.ts`
- Modify: `src/commands/schema.ts`
- Modify: `test/contracts.test.ts`
- Modify: `test/commands/schema.test.ts`
- Modify: `openspec/changes/redesign-lifecycle-engine/tasks.md`

**Step 1: Write failing registry and parity tests**

Assert that:

```ts
const contracts = getCommandContracts()
const discovered = (await commandsCommand()).data?.commands ?? []
const schemaNames = getSchemaCatalog().map(schema => schema.name)

expect(discovered).toEqual(contracts.map(toV1CommandDescriptor))
expect(new Set(contracts.map(contract => contract.name)).size).toBe(contracts.length)
expect(schemaNames.sort()).toEqual(contracts.map(contract => contract.schemaName).sort())
```

Also run `schemaCommand()` for `config`, `info`, `list`, `update`, `uninstall`, and `upgrade`, asserting successful resolution. Add negative registry-validation cases for duplicate command names, duplicate aliases, aliases colliding with names, duplicate effects, and missing schemas.

Run:

```bash
bun run test -- test/command-contract/registry.test.ts test/contracts.test.ts test/commands/schema.test.ts
```

Expected: fail because no registry exists and six stable schema documents are missing.

**Step 2: Add the internal registry**

Define `CommandContract` with the metadata that is truthful in this milestone:

```ts
export interface CommandContract {
  aliases: readonly string[]
  effects: readonly CommandEffect[]
  flags: readonly string[]
  name: StableCommandName
  schemaName: StableCommandName
  stability: 'stable'
  summary: string
}
```

Populate all 15 commands in current discovery order. Project the existing v1 descriptor shape via `toV1CommandDescriptor()` so internal aliases/effects do not leak into v1 output.

Add pure `validateCommandContractRegistry(contracts, schemaNames)` validation for the metadata represented now. Do not claim unresolved handler, option-shape, presenter, or result/event-schema validation until those fields move into the registry.

**Step 3: Remove the independent command catalog**

Change `commandsCommand()` to obtain descriptors from the registry. Preserve order, flags, summaries, stability, and `#/commands/<name>` references exactly.

**Step 4: Add the six missing stable schemas**

Export `JsonSchema` and `SchemaDocument` types from `src/commands/schema.ts`. Add truthful v1 data schemas for `config`, `info`, `list`, `update`, `uninstall`, and `upgrade`, based on their existing command result types. Preserve all nine existing schemas byte-for-byte except formatting required by the formatter.

**Step 5: Verify and update OpenSpec**

Run:

```bash
bun run test -- test/command-contract/registry.test.ts test/contracts.test.ts test/commands/schema.test.ts test/commands/commands.test.ts
bun run lint
bun run format:check
bun run typecheck
```

Mark tasks `1.2` and `3.3` complete. Leave `3.1`, `3.4`, and `3.6` incomplete: the milestone introduces their foundation, but handlers/presenters/options are not authoritative registry fields and schema generation is not yet registry-owned.

**Step 6: Commit**

```bash
git add src/command-contract src/commands/commands.ts src/commands/schema.ts test/command-contract test/contracts.test.ts test/commands/schema.test.ts openspec/changes/redesign-lifecycle-engine/tasks.md
git commit -m "refactor(cli): centralize command discovery contracts"
```

---

## Task 5: Milestone verification and delivery closure

> **Delivery override approved 2026-07-11:** The user expanded this milestone from repository-local closure to the protected integration workflow. Normalize the completed task commits into one conventional commit, validate and open a pull request whose base is exactly `codex/redesign-lifecycle-integration`, wait for the six required contexts plus PR Governance and code review, and merge only into integration. Follow `docs/runbooks/lifecycle-integration-delivery.md`; do not merge this milestone directly to `main`, publish, synchronize current specs, or archive either active change.

**Files:**

- Modify only if verification exposes defects: files already listed above

**Step 1: Run focused tests together**

```bash
bun run test -- test/compatibility/v1-baseline.test.ts test/runtime/invocation-context.test.ts test/lifecycle/plan-validation.test.ts test/command-contract/registry.test.ts test/contracts.test.ts test/commands/schema.test.ts test/commands/commands.test.ts
```

**Step 2: Run the repository gates**

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
bun run build
```

`build:bin`, release artifact generation, and local container/sandbox suites remain outside this internal foundation milestone unless a changed file or review finding triggers them. Push, PR creation, review, and merge now follow the approved integration delivery override above. Archive and release automation remain prohibited for this milestone.

**Step 3: Audit scope and compatibility**

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Confirm that no public root export was added/removed, no existing command/flag/schema was removed, no legacy default route changed, and no ignored PR/session material entered the diff.

**Step 4: Request two-stage review**

First verify implementation against this plan and the active OpenSpec change, then perform code-quality review. Fix all confirmed blocking or important findings and rerun affected gates.

**Step 5: Report closure honestly**

Report validation, OpenSpec, git, commit, remote, PR, merge, release, and archive states separately. The expected closure is one reviewed milestone commit merged into protected integration; `main` promotion, release, current-spec synchronization, and archive closure remain pending.
