## Context

Devin for Terminal is distributed through official install scripts for macOS/Linux/WSL and Windows, plus a Windsurf-bundled path that is enabled separately for enterprise users. The command reference documents a stable executable name (`devin`), a version subcommand (`devin version`, equivalent to `devin --version`), and a self-update command (`devin update`).

Quantex already models script-installed agents that rely on `selfUpdate` instead of managed package updates. Devin support should fit that existing lifecycle catalog shape without adding special-case product logic for Windsurf-bundled installs.

## Goals / Non-Goals

**Goals:**

- Add Devin as a supported Quantex lifecycle agent with verified upstream metadata.
- Preserve the official install scripts for each platform exactly as documented upstream.
- Expose the documented version and self-update commands so Quantex update planning can handle unmanaged Devin installs.

**Non-Goals:**

- Model Windsurf-bundled enablement or enterprise entitlement checks as a separate install method.
- Add managed npm, Bun, Homebrew, or winget metadata that is not documented upstream.
- Add Devin-specific auth, setup, MCP, or session-management behavior beyond catalog metadata.

## Decisions

### 1. Use `devin` as both the canonical slug and executable name

The upstream CLI command is `devin`, and it is specific enough to serve as both the Quantex agent slug and the executable identifier without aliases.

### 2. Record only the official script installers

Upstream quickstart documentation currently publishes shell and PowerShell installers, not managed package-manager installs. Quantex should keep only those official script methods in the catalog:

- macOS/Linux: `curl -fsSL https://cli.devin.ai/install.sh | bash`
- Windows: `irm https://static.devin.ai/cli/setup.ps1 | iex`

This keeps install guidance aligned with vendor documentation and avoids inventing unsupported package-manager paths.

### 3. Use the documented version and update commands

The command reference explicitly documents `devin version` and `devin update`. Quantex should use `devin version` as the explicit version probe and expose `devin update` as the self-update command for unmanaged installs. This matches the current Quantex update strategy, where script-installed agents can still advertise a built-in updater.

### 4. Treat the Windsurf-bundled path as out of scope for install metadata

The Windsurf-bundled install is a product-bundled distribution path rather than a standalone CLI installer that Quantex can execute directly. Quantex should support the `devin` binary once present on PATH, but it should not model the Windsurf entitlement flow as a separate install method.

## Risks / Trade-offs

- [Users may expect managed package installs because other agents support npm or brew] -> Keep the catalog limited to the official script methods that Devin actually documents today.
- [Bundled installs may update through the parent application instead of `devin update`] -> Use the documented self-update command for standalone installs and avoid claiming Windsurf-bundled update management in the catalog contract.
- [The version command has two documented forms] -> Use the explicit `devin version` subcommand because it is listed in the command reference and explicitly documented as equivalent to `devin --version`.
