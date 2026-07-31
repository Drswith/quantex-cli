## Why

An explicit `qtx upgrade` can currently trust a still-valid version-metadata cache and report that the CLI is up to date immediately after a new release. Users who intentionally ask Quantex to check for or install an update expect a current answer, while ordinary commands must remain offline.

## What Changes

- Refresh self-upgrade version metadata before planning an explicit `upgrade` check or execution.
- Preserve the existing cache-only behavior for passive self-update notices on ordinary commands.
- Add regression coverage for a fresh-but-stale cached version followed by an explicit self-upgrade command.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: explicit self-upgrade checks and executions refresh version metadata instead of treating a valid cache entry as authoritative.

## Impact

- Affected code: self-upgrade observation/planning and its command tests.
- Affected contract: `qtx upgrade --check` and `qtx upgrade` may perform their declared network metadata lookup even while cached metadata is within its normal TTL.
- No new flags, schema version, or agent-lifecycle behavior.
