## Why

Quantex currently provides reliable one-shot lifecycle commands, but it has no
desktop surface that can keep a low-overhead, user-controlled watch over the
agents it manages. A macOS client can make available updates visible without
duplicating lifecycle policy or allowing unattended mutations.

## What Changes

- Add a macOS-first Tauri desktop application with a React user interface,
  native tray lifecycle, configurable background update checks, and explicit
  user-confirmed updates.
- Add a managed-only batch update planning mode to the CLI. It uses recorded
  lifecycle state as its target set and supports a side-effect-free dry run for
  desktop background checks.
- Package architecture-matched Quantex CLI binaries with the desktop app and
  expose a narrow Rust IPC boundary; the desktop app never reads or writes
  Quantex lifecycle state directly.
- Add desktop build, typecheck, test, and macOS packaging verification paths.

## Capabilities

### New Capabilities

- `macos-desktop-client`: A macOS desktop surface that observes managed agent
  updates in the background and executes only explicitly confirmed updates.

### Modified Capabilities

- `agent-update`: Managed-only batch planning and dry-run update discovery.
- `cli-contract-registry`: The structured update contract exposes the new
  managed scope and command option.
- `package-distribution`: Desktop packaging consumes architecture-matched CLI
  release binaries without adding them to the npm package.

## Impact

- Adds the `apps/desktop` Bun workspace, Tauri/Rust dependencies, macOS build
  configuration, and desktop tests.
- Changes the `update` command's option parsing, batch target selection, and
  structured result scope while preserving existing `update --all` behavior.
- Adds release/build automation for desktop sidecars and unsigned local macOS
  bundles. Production signing and notarization remain unavailable until Apple
  credentials are supplied.
