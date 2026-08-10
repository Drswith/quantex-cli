## Context

`CoreMutationFailure` (`src/core/installation-executor-types.ts:124`) already carries everything a caller needs to diagnose a failed install:

```ts
readonly code: AgentMutationFailureCode
readonly phase: CoreMutationPhase
readonly reason: string
readonly remediation?: string
readonly retryable: boolean
readonly sideEffect: CoreMutationSideEffect
```

The resolver fills `reason` with real evidence — `No installation provider is currently available: deno: ...` (`src/core/installation-recipe-resolver.ts:167`), `install effect failed with exit code 1` (`src/package-manager/context-mutation.ts:19`). `projectMutationFailure` (`src/commands/core-installation-cli.ts:232-244`) then routes on `code` alone and drops `reason`, `remediation`, `phase`, and `retryable` on the floor for every code outside `recording-failed`, `decision-conflict`, `decision-indeterminate`, and `verification-failed`.

Installer process output is a separate matter and is **not** broken. `resolveCliProviderOutputPolicy` returns `'stderr'` in `--json` mode, and `spawnWithOutputPolicy` forwards both child streams to Quantex's stderr. That is why the `hermes` and `vibe` canary jobs show full upstream installer transcripts. `genie`, `openhands`, and `mimo` showed nothing because in those runs no installer child produced output, not because Quantex swallowed it. The defect is confined to the reason projection.

## Goals / Non-Goals

Goals:

- One diagnostic projection shared by the Core and legacy engines, so `install` and `ensure` cannot disagree about the same failure.
- Additive `error.details`, leaving `error.code` and existing `details.lifecycle` values byte-identical.
- Separate a decide-phase indeterminate outcome from a post-mutation verification failure.
- Let the canary skip an entry whose providers are all unavailable.

Non-Goals:

- Changing typed outcome kinds, provider selection, or retry behavior.
- Provisioning `deno` or `uv` in the canary workflow.
- Trusting or overriding an upstream installer's exit code (the `vibe` case).

## Decisions

### Project the failure into `details`, do not widen `message`

`CommandError.details` is `Record<string, unknown>` (`src/output/types.ts:15-19`), so new keys are contract-compatible; `message` is read by humans and is pinned by compatibility fixtures in places. The projection adds `reason`, and `remediation` when present, next to the existing `lifecycle` key.

`message` gains the reason as a suffix on the generic branch only — `Failed to install Genie: No installation provider is currently available: deno: ...` — because that branch's message is the one carrying no information today. The `recording-failed` and `verification-failed` branches keep their exact existing strings and gain the reason only in `details`.

Alternative rejected: emitting the whole `CoreMutationFailure`. `cause` is explicitly internal ("the public SDK projection deliberately strips it") and can hold arbitrary error objects, so it stays internal.

`phase` and `retryable` were in the first cut and were then dropped. The legacy engine has no equivalent for either, and the legacy/Core differential gate requires the two engines to be indistinguishable from their CLI payload. `details.lifecycle` already encodes the stage, so carrying them would have bought a nuance at the cost of that contract.

### The reason text is engine-specific, so the differential gate excludes it

The two engines describe the same failure in different vocabularies — v1 emits reason codes like `provider-binding-unresolved-after-install`, Core emits prose like `Fresh observation did not confirm the compatibility adoption source.` They cannot be made to converge without rewriting one engine's vocabulary, which is far outside this change.

`error.details.reason` and `error.details.remediation` therefore join `incomparableFields` in `test/compatibility/core-installation-differential.test.ts`, alongside the engine-local clock and the v1-unreported `phase`/`sideEffect`. This is consistent rather than convenient: the spec delta states the reason is diagnostic payload that nothing may branch on, and the gate exists to prove the engines agree on the *stable* contract. Everything else about the payload — code, lifecycle, data, exit code, warnings — is still compared exactly.

### `decision-conflict` folds into `decision-indeterminate`

Core distinguishes a conflict from an indeterminate decision; the legacy engine reports both as `indeterminate`. Emitting Core's finer code would reintroduce an engine divergence on a contract field, so both map to `details.lifecycle: 'decision-indeterminate'`. The distinction survives in `reason`, and the defect being fixed — claiming verification ran when it did not — is fixed either way.

The legacy mapper needs the mirror-image split. `reconcileAgentInstallation` returns `indeterminate` for blocked plans *and* `reconcileVerifiedMutation` returns it for an inconclusive post-install verification. The existing `-after-install` / `-after-ensure` reason suffix already distinguishes them, so it selects between the verification branch and the decision branch.

### Separate `decision-indeterminate` from `verification-failed`

Today `decision-conflict`, `decision-indeterminate`, and `verification-failed` all funnel into `verificationError()`, which claims the agent "could not be verified after installation". For a decide-phase failure that sentence is false twice over: no install ran, and no verification ran. This is the likely reading of the `openhands` canary job, which failed in 0.22s with `details.lifecycle: "verification-failed"` having installed nothing.

`decision-indeterminate` and `decision-conflict` get `details.lifecycle: 'decision-indeterminate'` and a message that says the state could not be determined. `verification-failed` keeps its current message and detail value verbatim.

This is the one place existing `details.lifecycle` values change for a given input, so it is called out for review rather than folded in silently. `error.code` stays `INSTALL_FAILED` throughout, which is what the compatibility fixtures and the smoke harness key on.

### Legacy engine reuses the same projection

`src/commands/install.ts:346-361` and `src/commands/ensure.ts:248-262` have the same collapse with a different reason vocabulary — there `outcome.reason` is a typed reason code, not free text. Both call the shared projection so a reader cannot tell the engines apart from the payload shape.

### Canary skip keys on the typed code, not the message

The smoke probe must not string-match `No installation provider`. It reads `error.details.lifecycle` for the new provider-unavailable marker, which the projection sets when the resolver reports every provider unavailable. Message text stays free to change.

Skips are counted and printed separately and do not mark the entry as passing, so a run that silently degrades into all-skips is visible.

## Risks / Trade-offs

- **A longer `message` on the generic branch.** Mitigated by only extending the branch whose message is content-free, and by keeping the reason single-line.
- **`details.lifecycle` gains new values.** Consumers doing exhaustive matching on that field see unfamiliar values. `error.code` is unchanged, and `verification-failed` still means what it meant; the change is that it stops being over-reported.
- **Reason text is not a stable contract.** Stated in the spec delta: it is diagnostic payload, and Quantex must not branch behavior on it. The canary consumes the typed marker for exactly this reason.

## Open Questions

- Whether `vibe`'s pattern — an upstream installer that exits non-zero after a materially successful install — deserves a catalog-level or provider-level answer. Recorded as a non-goal here; it needs its own proposal.
