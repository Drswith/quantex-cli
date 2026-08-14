## Context

`observeAgentLifecycle` builds one `evidenceConflicts` disjunction that decides whether an agent's observation carries `conflicting-source` drift. Two consumers read that drift:

- `confirmedBinding` (`src/services/lifecycle-updates.ts:604`) requires `drift.kind === 'none'` before an update can be planned. Anything else becomes `blocked` / `unsafe-source`.
- `verifySelfUpdatedObservation` (`:693`) and `verifyUpdatedObservation` (`:636`) require the same on the post-mutation observation before a receipt may be written.

Sharing one observation between planning and verification is the design's strength — and the reason a single wrong term deadlocks both halves.

### The wrong term

```ts
executablePathsConflict(receipt?.executablePath, executable.path, ports)
```

Every other term in `evidenceConflicts` compares two *live* facts: provider presence against executable presence, provider path against live path, provider version against live version. This one compares a **historical** fact — the path recorded at the last verified mutation — against a live one, and reports the difference as present-tense drift.

For a package provider the distinction is invisible: `~/.bun/install/global/node_modules/<pkg>/bin/<x>` is stable across upgrades, so the historical path stays accurate. For an installer that versions its install directory, the historical path is guaranteed to diverge the moment an upgrade succeeds.

### The observed deadlock

`script`-provider observation returns presence only — no path, no version (`src/providers/adapters/install-effect.ts:61`). So for Cursor CLI every other term is `false` and `receiptPathConflicts` alone decides. Traced on a live installation:

1. Receipt records `versions/2026.07.23-e383d2b/cursor-agent`; live path matches; drift `none`; update plans and runs `agent update`.
2. `agent update` succeeds and relocates the executable to `versions/2026.08.11-e8db854/cursor-agent`.
3. The post-update observation compares the new live path against the **not yet rewritten** receipt → drift `conflicting-source` → `verification-failed` → receipt is not written.
4. Every later run now fails at step 1: recorded path `2026.07.23`, live path `2026.08.11` → `blocked` / `unsafe-source`, nothing executes.

The receipt can only be refreshed by a verification that the stale receipt itself prevents.

## Goals / Non-Goals

**Goals**

- A successful relocating update verifies and refreshes its receipt.
- An installation already stuck in the deadlock heals on the next ordinary `qtx update`, with no manual state edit.
- Genuine two-source conflicts still fail closed.
- One rule, one code site, both halves fixed.

**Non-Goals**

- Extending the receipt schema (for example, recording an install root).
- Making the `script` provider report paths or versions.
- Loosening `sameBinding`, provider-vs-live path comparison, or version monotonicity.

## Decisions

### Scope receipt path evidence to the receipt's own version

A receipt records `version` alongside `executablePath`. Those two fields describe the same moment. When live observation reports a *different* version, the recorded path is known-stale by construction, and comparing it can only produce noise:

```ts
const liveVersion =
  executable.version ?? (providerObservation.kind === 'present' ? providerObservation.version : undefined)
const receiptPathConflicts = versionsConflict(receipt?.version, liveVersion)
  ? false
  : await executablePathsConflict(receipt?.executablePath, executable.path, ports)
```

`versionsConflict` already encodes "both known and semantically different", returning `false` whenever either side is unknown. So the comparison is skipped only on positive evidence that the install moved on; every ambiguous case keeps today's conservative behavior.

Walking the four cases:

| Receipt version vs live | Paths | Classification |
|---|---|---|
| same | same | no drift (unchanged) |
| same | differ | **drift** — two installs at one version, still fails closed (unchanged) |
| differ | differ | no drift — a relocating upgrade (**fixed**) |
| either unknown | differ | drift (unchanged, conservative) |

`compareVersions` orders Cursor's scheme correctly (`2026.08.11-e8db854 > 2026.07.23-e383d2b`), verified directly, so the monotonicity checks downstream stay meaningful for exactly the agent that motivated this change.

### Why this fixes verification without touching the verifier

Post-update, the receipt still holds the pre-update version. Live is the post-update version. They differ, so the receipt path drops out, drift is `none`, and `verifySelfUpdatedObservation` proceeds to the check it always wanted to make — `sameBinding` plus `compareVersions(afterVersion, beforeVersion) >= 0` at `:716-728` — and writes a receipt carrying the new path *and* the new version. The next run then compares equal versions and equal paths.

### Why the stuck state self-heals

An installation already carrying a stale receipt has receipt version ≠ live version, so the very first re-plan under this rule sees no drift and proceeds. Even when the agent is already current, the self-update path still re-observes, verifies `order === 0`, reports `up-to-date`, and rewrites the receipt with the correct path and version. Recovery needs no new command and no `state.json` editing.

### Alternatives rejected

- **Drop `receiptPathConflicts` entirely.** Loses the same-version two-install signal, which is the only path evidence a `script` provider has at all.
- **Compare install roots instead of full paths.** Requires inferring a root from a path string; a heuristic that is wrong for flat installers and unnecessary once version scoping is available.
- **Special-case `script`/`binary` providers.** Treats a general staleness bug as a provider quirk, and leaves the same deadlock latent for any package whose bin path moves between releases.
- **Refresh the receipt from the verifier before comparing.** Writes success-state evidence before the postcondition is satisfied, inverting `verify -> record`.

### Surfacing the reason

`renderUpdateHuman`'s `failed` branch prints `hint`, populated only for `provider-failed` (`src/commands/update.ts:539`). A `blocked` outcome carries its reason in `message`, which human mode discards — the reason this deadlock was invisible without `--json`. The `failed` branch prints `message` when present, on one line, matching the precedent set for install and ensure by `surface-install-failure-diagnostics`. `message` is already in the structured payload; nothing branches on its text.

## Risks / Trade-offs

- **A same-path, moved-on-version conflict goes unreported.** If two installs somehow shared a path but differed in version, the path term no longer fires — but identical paths never produced a conflict anyway, so nothing is lost.
- **Version-reporting regressions widen the skip.** If an agent's version probe breaks and returns a wrong-but-parseable version, the path check is skipped. `versionsConflict` returning `false` for unknown versions keeps the common failure (no version at all) on the conservative branch.
- **Receipts written before this change stay stale until the next update.** Acceptable: the first update under the new rule rewrites them, which is the self-healing property above.

## Migration Plan

None. No schema, flag, error code, or persisted format changes. Existing receipts are read as-is; the first `update` after upgrade refreshes any that had gone stale.

## Open Questions

None.
