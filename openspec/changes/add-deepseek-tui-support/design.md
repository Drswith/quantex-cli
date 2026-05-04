## Context

DeepSeek TUI publishes an npm package (`deepseek-tui`) that downloads the platform-specific `deepseek` and `deepseek-tui` binaries from GitHub release artifacts during install. The upstream README documents `npm install -g deepseek-tui`, `deepseek --version`, and `deepseek update`, and it identifies `deepseek` as the primary user-facing dispatcher command.

Quantex already models similar agents with one catalog entry that carries the lifecycle metadata needed by install, inspect, resolve, exec, and update planning. DeepSeek TUI should fit that existing catalog shape without requiring new package-manager or execution behaviors.

## Goals / Non-Goals

**Goals:**

- Add DeepSeek TUI as a supported Quantex lifecycle agent with verified upstream metadata.
- Use the primary `deepseek` binary as the canonical execution target while preserving `deepseek-tui` as a lookup alias.
- Expose the documented npm install path and `deepseek update` self-update command.

**Non-Goals:**

- Add DeepSeek-specific runtime behaviors beyond catalog metadata.
- Model source builds, direct GitHub release downloads, or cargo-based install flows in this change.
- Introduce new install-method types or architecture-specific catalog branching.

## Decisions

### 1. Use `deepseek` as the canonical slug and executable, with `deepseek-tui` as a lookup alias

The upstream package exposes both `deepseek` and `deepseek-tui`, but the README positions `deepseek` as the primary user entry point. Quantex should use `deepseek` as the canonical slug and executable name while accepting `deepseek-tui` as a stable lookup alias for users who identify the product by its package or companion binary name.

### 2. Expose the documented npm managed install method on all supported platforms

The verified install surface in upstream documentation is `npm install -g deepseek-tui`, and the npm package handles platform-specific binary download during `postinstall`. Quantex should therefore expose the npm managed install method on Windows, macOS, and Linux rather than inventing Bun, Homebrew, or script installers that upstream does not currently document as the primary packaged path.

### 3. Record both version probe and self-update behavior on the `deepseek` dispatcher

Upstream documents `deepseek --version` and `deepseek update` against the dispatcher binary, so Quantex should probe and update through `deepseek` rather than the companion `deepseek-tui` binary. This keeps lifecycle behavior aligned with the command users actually run.

## Risks / Trade-offs

- [The npm wrapper only supports selected OS/architecture combinations] -> Keep the catalog at the existing OS granularity and rely on upstream install-time validation for unsupported architectures.
- [Users may expect cargo/source install guidance in Quantex] -> Keep the initial support minimal and verified; additional install channels can be added later if Quantex decides to model source-based flows explicitly.
- [The alias could diverge if upstream changes branding] -> Limit the alias set to the currently shipped `deepseek-tui` binary and package name terminology.
