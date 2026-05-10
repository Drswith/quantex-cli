## Design

Cargo should fit the existing managed installer abstraction instead of introducing a separate Rust-specific lifecycle path. A Cargo install method is managed because Quantex can invoke deterministic install, update, and uninstall commands for a named crate.

## Decisions

### 1. Model Cargo as a managed install type

Add `cargo` to `ManagedInstallType` and the installer capability table with:

- `canInstall: true`
- `canUpdate: true`
- `canUninstall: true`
- `canLookupLatestVersion: false`

Cargo package version lookup is intentionally out of scope for this change. `cargo install --list` output is not a registry latest-version lookup and is not enough to support the existing latest-version contract.

### 2. Use Cargo's standard global commands

The Cargo installer executes:

- install: `cargo install <crate>`
- update: `cargo install <crate> --force`
- uninstall: `cargo uninstall <crate>`

Cargo does not have a direct global "upgrade this crate" command. Re-running `cargo install <crate> --force` is the managed refresh path Quantex uses so an existing crate install is overwritten instead of being ignored as already installed.

### 3. Keep package metadata explicit

Add optional `packages.cargo` metadata and a `cargoInstall(packageName?: string, packageInstallArgs?: string[])` helper. `getManagedPackageName` resolves in this order:

1. method-level `packageName`
2. installer-specific package metadata such as `packages.cargo`
3. npm metadata only for npm-compatible installers (`npm` and `bun`)

This avoids accidentally using an npm package name as a Cargo crate name.

Cargo install arguments are persisted with installed state so later update operations can reuse verified upstream flags such as `--locked`.

### 4. Do not make Cargo a default package manager

The `defaultPackageManager` config remains scoped to `bun` and `npm`. Cargo is not a general substitute for npm-compatible install methods and should only be selected when an agent definition explicitly offers a Cargo method.

## Non-goals

- Add Quantex self-upgrade through Cargo.
- Add crates.io latest-version lookup.
- Infer Cargo-managed installs from arbitrary binary paths.
- Model multi-crate Cargo install methods. DeepSeek TUI currently documents a dispatcher crate and a companion runtime crate; this change records the dispatcher crate that provides Quantex's canonical `deepseek` binary and leaves multi-crate install modeling as a follow-up if Quantex needs to install companion crates as part of one managed method.

## Risks

- Cargo reinstall behavior may rebuild crates and can be slower than binary package managers. This is acceptable because it matches Cargo's documented global install model.
- Some crates may require install flags such as `--locked`. This change keeps the generic Cargo method minimal; crate-specific flags should be modeled later if a concrete agent requires them.
