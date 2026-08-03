## Why

Quantex currently provides reliable one-shot lifecycle commands, but its first
desktop surface only exposes managed update checks. A useful desktop client
also needs the day-to-day lifecycle, discovery, diagnostics, and configuration
surfaces users otherwise have to find in the CLI, while keeping the CLI as the
single lifecycle and configuration authority.

## What Changes

- Add a macOS-first Tauri desktop application with a React user interface,
  native tray lifecycle, configurable background update checks, and explicit
  user-confirmed updates.
- Add complete desktop workflows for browsing supported agents, inspecting an
  agent, installing, ensuring, updating, uninstalling, opening an agent in the
  system terminal, running diagnostics, viewing capabilities, and editing
  Quantex configuration through stable CLI contracts.
- Add a managed-only batch update planning mode to the CLI. It uses recorded
  lifecycle state as its target set and supports a side-effect-free dry run for
  desktop background checks.
- Package architecture-matched Quantex CLI binaries with the desktop app and
  expose a narrow Rust IPC boundary; the desktop app never reads or writes
  Quantex lifecycle state directly.
- Add desktop build, typecheck, test, and macOS packaging verification paths.
- Build the browser mock surface from unmodified components installed by the
  project-local official shadcn CLI, using the default preset and theme rather
  than Desktop-specific component styling.

## Capabilities

### New Capabilities

- `macos-desktop-client`: A macOS desktop surface for agent lifecycle,
  discovery, diagnostics, Quantex configuration, and user-confirmed managed
  updates.

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
  structured result scope while preserving existing `update --all` behavior;
  the remaining desktop workflows consume existing structured CLI contracts.
- Adds release/build automation for desktop sidecars and unsigned local macOS
  bundles. Production signing and notarization remain unavailable until Apple
  credentials are supplied.
