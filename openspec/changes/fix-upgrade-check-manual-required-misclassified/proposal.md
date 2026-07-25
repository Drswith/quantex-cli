## Why

`quantex upgrade --check` and dry-run map every non-`update-available` plan status through a shared `NETWORK_ERROR` / `check-unavailable` fallthrough. That path incorrectly rewrites real `manual-required` plans (source or otherwise non-auto-update installs) into a network failure, so agent-facing structured output lies about the remediation class. Plain `quantex upgrade` already emits `MANUAL_ACTION_REQUIRED` for the same plan.

## What Changes

- Handle `plan.status === 'manual-required'` before the `--check` / dry-run fallthrough so check, dry-run, and normal upgrade share the same structured `MANUAL_ACTION_REQUIRED` result.
- Keep the check/dry-run fallthrough for genuine `check-unavailable` network/manifest failures.
- Add regression coverage for `--check` and dry-run against `manual-required` plans.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `self-upgrade`: explicit-check / dry-run surfaces must preserve `manual-required` instead of collapsing it into unresolved-latest / network failure.

## Impact

- `src/commands/upgrade.ts` status mapping order
- `test/commands/upgrade.test.ts` regression coverage
- OpenSpec change `fix-upgrade-check-manual-required-misclassified`
- Related open PR #505 covers plain-upgrade `check-unavailable` crashes; this change is complementary and does not broaden that slice

## Work-intake classification

Observable CLI behavior and stable structured output change → OpenSpec required before implementation.
