## Why

Some lifecycle-managed coding agents are distributed as Rust crates. Quantex currently has managed installers for Bun, npm, Homebrew, and winget, but it cannot model or execute a first-class Cargo install path.

This work is OpenSpec-required because it changes agent catalog install-method metadata, managed lifecycle execution, diagnostic output, and batch update planning.

## What Changes

- Add `cargo` as a managed package-manager install type.
- Detect whether `cargo` is available in `PATH`.
- Execute Cargo-managed install, update, batch update, and uninstall operations through Cargo commands.
- Render Cargo install guidance in resolve/exec/list/info surfaces that already expose install methods.
- Include Cargo availability in `capabilities` and `doctor` diagnostics.
- Keep Quantex self-upgrade and the `defaultPackageManager` configuration scoped to the existing supported self-install sources; Cargo is an agent lifecycle installer, not a Quantex self-upgrade provider.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Supported agent entries may declare Cargo managed install methods and package metadata.
- `agent-update`: Cargo-managed installs participate in managed install, update, batch update, uninstall, and diagnostic planning.

## Impact

- Affected code: `src/agents/types.ts`, `src/agents/methods.ts`, `src/package-manager/`, `src/utils/`, `src/services/update.ts`, `src/commands/capabilities.ts`, `src/commands/doctor.ts`, and related tests.
- Affected structured output: `quantex capabilities --json` and `quantex doctor --json` installer maps gain a `cargo` key.
- No new runtime dependency is required.
