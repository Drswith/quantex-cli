## Why

PRs #312 and #315 made `state.json` fail closed on invalid JSON and semantically invalid `installedAgents` records, but valid JSON whose root value is not an object (for example `[]`, `123`, or `"text"`) still loads as empty state. The next mutation overwrites previously recorded install metadata without surfacing an error.

## What Changes

- Reject `state.json` whose parsed root is not a plain object with a state read error.
- Add regression tests for array, primitive, and boolean JSON roots.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `quantex-state`: extend corrupt-state fail-closed behavior to non-object JSON roots.

## Impact

- `src/state/index.ts`
- `test/state.test.ts`
- Lifecycle commands that load persisted state will surface `StateFileError` instead of silently discarding install records.
