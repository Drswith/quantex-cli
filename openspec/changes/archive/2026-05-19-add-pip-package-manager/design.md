## Design

pip should fit the existing managed installer abstraction instead of introducing a separate Python-specific lifecycle path. A pip install method is managed because Quantex can invoke deterministic install, update, and uninstall commands for a named Python package.

## Decisions

### 1. Model pip as a managed install type

Add `pip` to `ManagedInstallType` and the installer capability table with:

- `canInstall: true`
- `canUpdate: true`
- `canUninstall: true`
- `canLookupLatestVersion: false`

pip package version lookup via PyPI API is intentionally out of scope for this change. The initial implementation focuses on reliable install/update/uninstall operations without adding PyPI registry queries.

### 2. Use pip's standard global commands

The pip installer executes:

- install: `pip install <package>`
- update: `pip install --upgrade <package>`
- uninstall: `pip uninstall -y <package>`

All commands use the `pip` binary detected in PATH. If `pip` is not available, the fallback detection tries `pip3` and then `python -m pip`.

### 3. Keep package metadata explicit

Add optional `packages.pip` metadata and a `pipInstall(packageName?: string)` helper. `getManagedPackageName` resolves in this order:

1. method-level `packageName`
2. installer-specific package metadata such as `packages.pip`
3. npm metadata only for npm-compatible installers (`npm` and `bun`)

This avoids accidentally using an npm package name as a pip package name.

### 4. Do not make pip a default package manager

The `defaultPackageManager` config remains scoped to `bun` and `npm`. pip is not a general substitute for npm-compatible install methods and should only be selected when an agent definition explicitly offers a pip method.

### 5. Cross-platform pip detection

pip availability detection follows this order:

1. Try `pip --version`
2. Try `pip3 --version`
3. Try `python -m pip --version`

Once a working pip command is found, it is used for all subsequent operations in that session. This approach handles common scenarios:

- Systems where only `pip3` is available (common on macOS/Linux)
- Systems where pip is only available as a Python module
- Systems with both `pip` and `pip3` available

## Non-goals

- Add Quantex self-upgrade through pip.
- Add PyPI latest-version lookup.
- Infer pip-managed installs from arbitrary binary paths.
- Manage Python virtual environments, pyenv, asdf, or uv tool installs.

## Risks

- pip may require elevated permissions on some systems for global installs. The current implementation does not add `--user` flag automatically; users should ensure their pip configuration supports global installs or use `--user` flag externally.
- Some packages may have system-level dependencies that pip cannot resolve. This is acceptable because Quantex focuses on the package manager lifecycle, not system dependency resolution.
