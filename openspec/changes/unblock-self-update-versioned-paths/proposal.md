## Why

An installer that places each release in its own directory and repoints a launcher symlink — Cursor CLI's `~/.local/bin/agent -> ~/.local/share/cursor-agent/versions/<version>/cursor-agent` is the shipped example — makes a *successful* update look like source drift. The lifecycle receipt still records the previous release's path, live observation reports the new one, and `receiptPathConflicts` classifies the pair as `conflicting-source`. Post-update verification then refuses to record the receipt, so the stale path is never refreshed, and every later run is blocked at planning with `unsafe-source` before anything executes.

The result is a permanent deadlock reproduced on a real installation: `qtx update --all` reported `Failed to update Cursor CLI.` on three consecutive runs while the agent itself had already moved from `2026.07.23-e383d2b` to `2026.08.11-e8db854`. The recorded receipt stayed pinned at `2026.07.23-e383d2b` / `verifiedAt: 2026-08-04`. Only `--json` carried the reason (`The recorded update source does not match live provider evidence.`); human output printed the fixed failure line and dropped it.

Work intake classification: this changes observable `update` planning and verification outcomes plus human failure output, so it is OpenSpec-gated rather than a mechanical cleanup.

## What Changes

- A lifecycle receipt's `executablePath` becomes evidence **for the version that receipt recorded**. When live observation reports a different version than the receipt, the recorded path is stale by construction and no longer contributes to source-drift classification. Paths compared at the same recorded version keep failing closed exactly as today.
- Because planning and post-mutation verification share one observation path, this also releases the verification side: a self-update that relocates its executable to a new versioned directory now satisfies its postcondition through binding identity and version monotonicity, and refreshes the receipt with the new path and version. The stuck state is self-healing on the next `qtx update` — no manual `state.json` surgery.
- Human `update` output carries the typed failure reason on the failure line, matching what `--json` already returns in `data.results[].message`. It stays one line.
- Not changed: the `conflicting-source` / `unsafe-source` classifications themselves, the typed outcome kinds, provider selection, receipt schema, error codes, or the rule that Quantex never branches reconciliation on free-form message text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lifecycle-reconciliation` — receipt path evidence MUST be scoped to the version the receipt recorded, so a relocated executable at a moved-on version is not classified as source drift.
- `agent-update` — self-update completion MUST NOT require a stable executable path, and update failure output MUST expose the blocking reason in human mode.

## Impact

- `src/lifecycle/agent-observation.ts` — the `receiptPathConflicts` term inside `evidenceConflicts`, the single site that turns a stale recorded path into `conflicting-source` drift.
- `src/commands/update.ts` — `renderUpdateHuman`'s `failed` branch, which prints `hint` (populated only for `provider-failed`) and drops `message`.
- No change to `src/services/lifecycle-updates.ts`: `verifySelfUpdatedObservation` already verifies binding identity and version monotonicity at `:716`, and its drift gate at `:693` becomes correct once the observation stops reporting stale-path drift.
- Structured output: unchanged. `data.results[].message` already carries the reason; this change only stops discarding it in human mode.
- `test/` — coverage for the version-scoped receipt path rule, the self-update-relocates-executable round trip, and the human failure line.

## Non-Goals

- Changing how `conflicting-source` or `unsafe-source` are classified, named, or reported in structured output.
- Recording an install root in the receipt, or any other receipt schema change.
- Reconciling `doctor` reporting `outdated: false` for a self-updating agent while `update --all` always attempts it. That comes from `createSelfUpdatePlanning` hardcoding `decision: 'upgrade'` because no latest version is resolvable for self-updating agents, and is a separate contract question about how self-update agents report update availability.
- Teaching the `script` provider to report an executable path or version from its presence probe.
