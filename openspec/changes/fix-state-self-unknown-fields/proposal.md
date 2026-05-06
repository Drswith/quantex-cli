# Fix state.json self unknown-field loss

## Why

`readState` normalized `self` to only three typed fields. Any subsequent `mutateState` read-merge-write dropped unknown keys from `state.json`, causing silent data loss for forward-compatible or experimental `self` entries.

## What changes

- `readState` spreads persisted `self` object (when it is a plain object) so write-backs preserve unknown keys.
- Regression test ensures unknown `self` keys survive a state mutation.

## Capabilities

### New Capabilities

- `state-persistence`: Forward-compatible merge rules for `state.json` `self` so mutations do not drop unknown keys.

### Modified Capabilities

None.

## Impact

- Low risk: restores prior merge behavior for `self` while keeping typed fields for in-process use.
