## Context

`runSelfUpgradeApplication()` returns `{ kind: 'planned', plan }` whenever the plan is not `update-available`, including `check-unavailable`. The upgrade command already maps that status to structured `NETWORK_ERROR` when `--check` or `--dry-run` is set, but the normal upgrade path falls through to `throw new Error('Self-upgrade execution did not produce a result.')`. Command runtime only normalizes `StateFileError`, so this becomes an unstructured CLI crash.

Live `v1.2.0` has zero release assets, so stable binary planning fails closed to `check-unavailable`. Users running plain `quantex upgrade` therefore hit the crash today.

## Goals / Non-Goals

**Goals:**

- Return the same structured unavailable result for plain `quantex upgrade` that `--check` already returns.
- Keep planning fail-closed (no mutation when latest cannot be resolved).
- Add a focused regression test for the missing branch.

**Non-Goals:**

- Do not change release workflow ordering (already covered by open PR #502).
- Do not change client manifest URL strategy or add fallback to a previous tag.
- Do not heal the empty live `v1.2.0` release assets.
- Do not broaden upgrade status handling beyond `check-unavailable`.

## Decisions

### Decision: handle `check-unavailable` before the executed-outcome guard for all upgrade modes

Move or duplicate the structured `NETWORK_ERROR` path so it applies outside the `options.check || dryRun` branch. Prefer one shared early return when `plan.status === 'check-unavailable'` so check/dry-run/normal modes stay aligned.

Why this over treating unavailable as `up-to-date`:

- Existing self-upgrade specs forbid claiming up-to-date when latest cannot be resolved.

Why this over changing application-layer outcome kinds:

- Application already correctly returns a planned outcome; the bug is command-layer handling of that planned status.

## Risks / Trade-offs

- [Risk] Reviewers may confuse this with the empty-release workflow fix → Mitigation: keep scope to CLI structured output; leave release recovery and workflow ordering to PR #502 / maintainer bootstrap.
- [Risk] Exit code / presentation differences between check and plain upgrade → Mitigation: reuse the existing error result shape and human renderer already used by `--check`.

## Migration Plan

1. Land the command-layer fix and regression test.
2. Archive this OpenSpec change after merge and spec sync.
3. Live empty `v1.2.0` recovery remains a separate maintainer owner.

## Open Questions

- None for this narrow slice.
