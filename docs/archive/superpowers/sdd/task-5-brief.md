### Task 5: Command-Specific Replay Validation (OpenSpec 7.5–7.6)

**Goal:** replace action/target/PATH replay with versioned canonical request evidence and live command-specific postconditions while preserving the v1 CLI protocol.

**Files:**
- Create: `src/idempotency/replay.ts`
- Modify: `src/command-runtime.ts`, `src/cli.ts`
- Modify: `src/commands/install.ts`, `src/commands/ensure.ts`, `src/commands/update.ts`, `src/commands/uninstall.ts`
- Test: `test/idempotency/replay.test.ts`, `test/command-runtime.test.ts`
- Test relevant command and v1 compatibility suites.

**Non-negotiable decisions:**
- Read-only commands never load, replay, or persist idempotency evidence.
- Dry runs and failed/cancelled/timed-out results never replay or persist.
- Invalid retained evidence and canonical request mismatch return stable `INVALID_ARGUMENT`, do not run, and remain byte-for-byte unchanged.
- Equivalent target sets canonicalize to one request; target/options differences do not.
- Same request + satisfied live postcondition replays the stored success with fresh public meta.
- Same request + resolved-plan change, receipt/source drift, failed postcondition, or inconclusive live evidence runs normal reconciliation; only a new verified success may replace evidence.
- Never expose internal plans, receipts, fingerprints, or validators in v1 result schemas.
- Preserve timeout/cancellation/locks/non-interactive/output routing and the passive-notice boundary.

#### Task 5A: Pure replay decision model

- Add failing decision-table tests for missing, expired, invalid, request mismatch, equivalent reordered targets, resolved-plan change, live satisfied, drifted, and inconclusive.
- Implement pure/injected replay evaluation in `src/idempotency/replay.ts`; no filesystem, CLI context, presenter, provider, state, or command imports.
- Decisions must retain stable requested/existing request and plan fingerprints for the runtime error/replacement boundary.
- Focused gate: replay + canonical/schema tests; format/lint/typecheck.
- Independent review; commit `refactor(idempotency): define replay decisions`.

#### Task 5B: Versioned runtime policy boundary

- Extend `ExecuteCommandOptions` with an optional command-specific policy that supplies canonical request, current resolved-plan identity, live validation, and successful evidence capture.
- Keep legacy runtime behavior only as a temporary fallback for mutation commands not yet migrated in this subtask; policy-backed paths exclusively use versioned load/save.
- Implement retained-invalid/request-mismatch `INVALID_ARGUMENT`, fresh-meta replay, drift reconciliation, success-only replacement, and no-overwrite on rejected evidence.
- Re-read immediately before replacement and refuse overwrite if a different valid request appeared; do not hide concurrency conflicts.
- Add runtime RED/GREEN cases with injected policies. Preserve timeout/cancellation/passive notice behavior.
- Focused gate: command-runtime + replay/storage/schema; independent review; commit `refactor(runtime): adopt versioned replay policies`.

#### Task 5C: Command policies and legacy runtime removal

- Normalize aliases to canonical agent names before request construction. Install batches sort/deduplicate targets; update `--all` identity comes from the deterministic batch plan, not presentation ordering.
- Presence policies (`install`, `ensure`) validate compatible live presence plus receipt/provider evidence.
- Update policy validates the recorded provider target and semantic version postcondition; changed `latest` resolution or provider/receipt source is drift and reconciles normally.
- Absence policy (`uninstall`) requires conclusive live absence; unknown/conflicting evidence is not replayable.
- Capture only successful verified command outcomes. Aggregate batch receipt/postcondition details as canonical extension fields without inventing orchestration semantics.
- Remove legacy replay/store use from runtime once all four mutating commands pass policies. Keep legacy storage exports only for compatibility until milestone closure confirms no callers.
- Cover target-option changes, reordered equivalent inputs, latest-target changes, batch targets, drift, dry run, failure, expiry, corrupt/legacy/unsupported evidence, and byte-for-byte no-overwrite.
- Focused gate: replay/runtime/install/ensure/update/uninstall/v1 compatibility; independent review; commit `refactor(idempotency): validate command replays`.

**Recovery rule:** finish and review 5A before 5B, and 5B before 5C. Do not combine checkpoint fixes with OpenSpec task updates; Task 6 owns milestone checkboxes and delivery normalization.
