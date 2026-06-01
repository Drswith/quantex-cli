## Context

Quantex runs Bun global install or update, then probes `bun pm -g untrusted` to decide whether requested packages need `bun pm -g trust`. The probe helper returns `undefined` when the command exits non-zero or cannot be spawned. `trustBlockedGlobalPackages` currently treats both `undefined` and an empty string as success, so a failed probe skips trust while the outer install or update still returns `true`.

## Decisions

### 1. Distinguish probe failure from an empty untrusted listing

Return `false` from the trust step when the untrusted probe result is `undefined`. Continue returning `true` when the probe exits successfully with an empty listing and no requested packages appear in the parsed output.

### 2. Keep trust scope unchanged

Only trust blocked packages whose names were explicitly requested by the current install or update operation.

## Risks

- Older Bun versions without `bun pm -g untrusted` would fail managed installs instead of silently skipping trust. Quantex already depends on this command for blocked lifecycle handling; failing closed is preferable to reporting success with a broken binary.
