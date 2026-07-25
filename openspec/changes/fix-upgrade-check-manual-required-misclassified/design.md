## Context

`upgradeCommand()` handles `up-to-date` first, then enters an `options.check || dryRun` branch that only special-cases `update-available` and otherwise returns structured `NETWORK_ERROR` with `status: 'check-unavailable'`. The real `manual-required` mapper sits after that branch, so `--check` and dry-run never reach it.

Live reproduction from a source checkout of `v1.2.0`:

- `quantex upgrade --json` → `MANUAL_ACTION_REQUIRED` / `manual-required`
- `quantex upgrade --check --json` → `NETWORK_ERROR` / `check-unavailable`

Open PR #505 only lifts `check-unavailable` handling for plain upgrade and explicitly does not broaden other status mapping.

## Goals / Non-Goals

**Goals:**

- Make `--check`, dry-run, and normal upgrade emit the same structured `MANUAL_ACTION_REQUIRED` result for `manual-required` plans.
- Preserve `NETWORK_ERROR` for genuine `check-unavailable` plans under `--check` / dry-run.

**Non-Goals:**

- Do not change how planning decides `manual-required` vs `check-unavailable`.
- Do not land the plain-upgrade `check-unavailable` crash fix here (owned by open PR #505).
- Do not redesign Windows deferred binary replacement or empty-latest release healing.

## Decisions

### Decision: handle `manual-required` before the check/dry-run fallthrough

Move the existing `manual-required` mapper above `if (options.check || dryRun)` so all modes share one structured path, mirroring how `up-to-date` is already handled early.

Why this over adding a nested branch only inside the check block:

- Keeps one source of truth for recovery hint + `MANUAL_ACTION_REQUIRED` payload.
- Prevents dry-run from inventing a second divergent mapping.

## Risks / Trade-offs

- [Risk] Overlap with open PR #505 touching the same file → Mitigation: keep this diff limited to reordering `manual-required`; do not duplicate the `check-unavailable` early return from #505.
- [Risk] Callers that incorrectly depended on `--check` returning network errors for source installs → Mitigation: that behavior was a contract bug; agents should key off `MANUAL_ACTION_REQUIRED`.

## Migration Plan

1. Land the command-layer fix and regression tests.
2. Archive this OpenSpec change after merge and spec sync.
3. Leave #505 and live `v1.2.0` empty-release recovery as separate owners.

## Open Questions

- None for this narrow slice.
