## Why

Quantex currently ships an npm/bun `postinstall` hook only to persist `state.self.installSource` for managed self-upgrade. That hook is narrow and low-risk, but it still triggers user concern because package-manager install scripts are security-sensitive by default, and binary installs never rely on it anyway. We should move that persistence to first-run runtime inspection so managed installs keep the same self-upgrade behavior without an install-time script.

## What Changes

- Remove the managed-install `postinstall` entrypoint from the published package and packaging checks.
- Make self install-source persistence happen lazily during runtime self inspection instead of package-manager install time.
- Keep managed self-upgrade, doctor, and related self surfaces compatible for existing installs with no persisted state.
- Update tests and runbooks to describe runtime reconciliation instead of install-time `postinstall`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: persisted self install-source knowledge is now established through runtime reconciliation rather than a managed-install `postinstall` hook.
- `package-distribution`: the managed-install tarball no longer needs a postinstall entrypoint, but must still keep the runtime CLI files required for lazy self inspection.

## Impact

- Affected code: `package.json`, `scripts/verify-package-distribution.ts`, `src/self/`, and self-related tests.
- Affected contracts: managed-install package contents, self install-source persistence timing, and self-upgrade debugging guidance.
- Dependencies: no new runtime dependency.
