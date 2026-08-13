## Context

Four sites decide whether a provider binding carries an executable name, and they do not agree for package providers:

| Site | Rule | `bun` package result |
|---|---|---|
| `resolveStateProviderBinding` (`src/lifecycle/provider-binding.ts:30`) | set only for `binary`, `script`, `deno`, or when state records one | absent |
| `resolveReceiptProviderBinding` (`src/lifecycle/provider-binding.ts:48`) | set whenever the receipt has `executableName` | present iff the receipt has it |
| install, both engines (`src/core/installation-production.ts:213`, `src/lifecycle/agent-installation.ts:74`) | conditional spread over the binding's `binaryName` | receipt written **without** it |
| update (`src/services/lifecycle-updates.ts:775`) | unconditional `after.agent.binaryName` | receipt written **with** it |

The repository already has one answer to this asymmetry: `providerBindingsEqual(left, right, defaultExecutableName)` normalizes both sides through `?? defaultExecutableName` (`src/lifecycle/provider-binding.ts:97`). `src/core/installation-recipe-resolver.ts:353` implements the same normalization for the Core recipe path. Only `src/commands/uninstall.ts:275` compares raw, and it is the one site that reports a false conflict.

## Goals / Non-Goals

**Goals**

- `qtx uninstall` stops reporting a conflicting source for evidence that agrees modulo the agent's default executable name.
- One definition of binding equality for the uninstall reader, shared with the rest of the lifecycle code.
- Test fixtures reflect the receipt shape that `qtx update` actually persists.

**Non-Goals**

- Making the four writer/reader sites agree on when to spell out the executable name. Out of scope here; see "Rejected alternatives".
- Changing the `conflicting-source` classification, its error code, or its `details.lifecycle` value.
- Migrating or rewriting receipts already on disk.

## Decisions

### Fix the reader, not the writers

The comparator is the defect: it is a copy of `providerBindingsEqual` that dropped the `defaultExecutableName` parameter. Restoring the fallback is the minimal change that matches the repository's existing answer.

It is also the only change that helps users who already have the affected receipts. Every affected machine has a receipt with `executableName` and state without it; normalizing the writers would leave those receipts exactly as they are, and uninstall would keep failing until the agent was reinstalled. The reader has to tolerate both shapes whatever the writers do.

### Keep `conflicting-source` for real conflicts

A receipt naming an executable that matches neither the recorded state nor the agent's declared `binaryName` is genuine evidence of two sources, and continues to fail closed. The two unchanged `conflicting-source` sites in `src/commands/uninstall.ts` (recorded target absent while the binary is live, at `:108`; residual PATH copy after managed removal, at `:209`) are unaffected.

### Correct the fixture rather than add a second one

`test/commands/uninstall.test.ts`'s `managedReceipt` is the only lifecycle-receipt fixture in the repository without `executableName`; every other suite pins `executableName: 'test-bin'`. That omission is what let both sides of the comparison be `undefined`, so the whole suite exercised a shape `qtx update` never writes. Correcting the shared fixture makes the existing positive cases carry the regression, and dedicated cases then pin the boundary explicitly.

## Rejected alternatives

**Make `qtx update` write `executableName` conditionally, matching install.** Rejected: it does not repair existing receipts, and it removes information rather than adding it. The receipt's executable name is consumed as one identity candidate in observation (`src/lifecycle/agent-observation.ts:444`) and as absence-verification evidence in idempotency replay (`src/idempotency/lifecycle-policy.ts:764`), both of which already apply their own `?? agent.binaryName` fallback — so the field is harmless when present and merely redundant. Dropping it is a data-loss direction taken to serve a comparator that should not have been strict.

**Make both install engines write `executableName` unconditionally, matching update.** Rejected for this change: the Core install receipt shape is pinned by the legacy/Core differential gate (`test/compatibility/core-installation-differential.test.ts`), so changing it is a larger, separately-justified change, and it still leaves already-written receipts unmigrated.

**Normalize on read in `resolveReceiptProviderBinding`.** Rejected: that function has other callers which legitimately need to know whether the receipt itself recorded a name, and it does not receive the agent definition needed to resolve the default.

## Risks / Trade-offs

- **A real two-source conflict is now missed if the second source happens to use the agent's default executable name.** Accepted: that case is already indistinguishable in the recorded evidence, and the downstream provider observation and PATH postcondition checks (`src/commands/uninstall.ts:102`, `:191`) remain the enforcement for what is actually installed.
- **The writer asymmetry survives this change**, so a future comparator written against these bindings can reintroduce the same bug. Mitigated by removing the duplicate comparator, so the fallback-aware version is the only one in the uninstall path.

## Validation gap this exposes

The canary lifecycle smoke runs `install → update → uninstall` for `opencode`, yet cannot reach the branch that writes the receipt: the agent is installed at the registry's newest version, so `decideUpdate` returns `up-to-date` (`src/lifecycle/update-planner.ts:70`) and execution short-circuits before `createReceipt` (`src/services/lifecycle-updates.ts:460`). Only a real upstream version bump between install and update reaches it, which no single CI job can produce.

Closing that gap needs a seeded-old-version update scenario in `scripts/smoke/lifecycle-smoke.ts`, and a cross-command contract test asserting that every receipt writer's output is accepted by the uninstall reader. Both are larger than this fix and are recorded here as follow-up rather than bundled in.
