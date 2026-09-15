## Why

Work-intake: observable CLI update/verification behavior, requested because current main still breaks the Codex PATH-relocation case once a newer package version exists.

`v1.13.5` (`#743`) lets `qtx update` plan against a recorded bun/npm package when PATH has moved off the receipt shim. After the package actually updates, re-observation still treats PATH `--version` vs provider version as `conflicting-source`, so verification fails, the receipt is not written, and later updates return `The recorded update source does not match live provider evidence`.

## What Changes

- Keep planning against the recorded package/formula source after PATH relocates, including when PATH still reports the previous binary version.
- After a successful recorded-package update, verify completion from the bound provider version rather than the leftover PATH binary.
- Do not treat PATH vs provider version skew as source drift when the recorded target is a package/formula and PATH has relocated off the receipt path.
- Keep fail-closed behavior when the provider reports a conflicting live executable path, or when PATH and provider versions disagree at the same path.
- No `--json` field, alias, exit-code, state v2, or receipt-schema change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: recorded package updates that succeed must verify against the provider version when PATH still points at the previous relocated binary.
- `lifecycle-reconciliation`: PATH vs provider version skew after a package/formula PATH relocation is not source drift; the managed version is the bound provider version.

## Impact

- `src/core/lifecycle/agent-observation.ts` recorded-binding evidence and version projection.
- `src/core/update-executor.ts` post-mutation verification through the same observation.
- Regression coverage in `test/lifecycle/agent-observation.test.ts` and `test/services/lifecycle-updates.test.ts`.
- Users with Codex (or similar) in `~/.local/bin` while bun/npm still owns the recorded package can complete `qtx update` instead of mutating then failing closed.
