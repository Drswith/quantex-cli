## Why

Implementation requested work-intake classification: this change modifies observable `qtx upgrade` behavior, self-upgrade configuration, and product-facing documentation, so it requires OpenSpec before file edits.

Quantex currently checks the latest package version against the official npm registry while Bun/npm upgrades install from the registry configured on the user's machine. In mirrored environments this creates false-positive upgrade prompts and false-success upgrade output, because Quantex can announce a newer upstream version that the selected registry cannot yet install.

## What Changes

- Resolve managed self-upgrade version checks against the same registry that the matching package manager will use for installation.
- Add self-upgrade-specific registry overrides so users can keep a mirror for general package work while opting Quantex self-upgrade into a different registry when needed.
- Verify the installed Quantex version after Bun/npm self-upgrades and fail with recovery guidance when the installed version does not match the target version.
- Warn when the selected managed-install registry lags behind the official npm release so users understand why a newer upstream version is not yet installable from their current source.
- Update README and the self-upgrade debugging runbook to document registry-sensitive self-upgrade behavior and mirror-lag troubleshooting.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: managed self-upgrade checks, installation, and recovery messaging now depend on a resolved self-upgrade registry and post-upgrade verification.
- `product-readme`: the README upgrade guidance now calls out registry-sensitive self-upgrade behavior and mirror lag.

## Impact

- Affected code: `src/self/`, `src/package-manager/`, `src/utils/version.ts`, `src/config/`, `src/commands/upgrade.ts`
- Affected docs: `README.md`, `README.en.md`, `docs/runbooks/release-and-self-upgrade-debugging.md`
- Affected tests: self-upgrade, config, package-manager, and version utility test coverage
