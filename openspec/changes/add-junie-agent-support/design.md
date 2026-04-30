## Context

Junie CLI is distributed by JetBrains through multiple upstream channels: an npm package (`@jetbrains/junie`), platform install scripts, and a Homebrew tap for macOS/Linux. The official CLI reference documents `junie --version` and automated update checks (`--skip-update-check`, `auto-update` config), but it does not document a dedicated `junie update` style command.

Quantex already models similar agents with a single catalog entry that carries the lifecycle metadata used by install, inspect, resolve, exec, and update planning. Junie support should fit that existing shape without adding product-specific command exceptions.

## Goals / Non-Goals

**Goals:**

- Add Junie as a supported Quantex lifecycle agent with verified upstream metadata.
- Prefer install methods that preserve Quantex's managed-update behavior when the user installs through npm or Bun.
- Preserve official script and Homebrew paths so human-facing guidance and fallback installs stay aligned with upstream documentation.

**Non-Goals:**

- Add Junie-specific runtime behaviors beyond catalog metadata.
- Implement a synthetic self-update command when upstream does not document one.
- Model Junie's GitHub Action, ACP mode, or IDE-specific workflows in this change.

## Decisions

### 1. Use `junie` as both the canonical slug and executable name

The upstream binary command is `junie`, and it is specific enough to serve as the Quantex-facing identifier without aliases or branding exceptions.

### 2. Expose Bun and npm managed installs on all platforms, plus official scripts and Homebrew where documented

Junie publishes the `@jetbrains/junie` package on npm, so Quantex can support both npm and Bun managed installs consistently with other package-backed agents. On macOS and Linux, the catalog also keeps the official shell installer and the Homebrew tap formula. On Windows, the catalog keeps the official PowerShell install script.

Using managed methods first preserves stronger Quantex lifecycle behavior for installs performed through `quantex install junie`, while still keeping the upstream script paths available for users who prefer them.

### 3. Record a version probe but no self-update command

The CLI reference documents `junie --version`, so Quantex should use that as the explicit version probe. Upstream documentation describes automated update checks and configuration flags, not a dedicated update subcommand, so the catalog should omit `selfUpdate` rather than inventing one.

### 4. Use the explicit Homebrew tap formula identifier in the catalog

JetBrains documentation and repository text currently show slightly different Homebrew tap wording, but the public tap repository exists at `jetbrains-junie/homebrew-junie`. Quantex should record the install target as `jetbrains-junie/junie/junie`, which maps directly to a brew-installable formula path and avoids needing separate tap-state assumptions in the catalog.

## Risks / Trade-offs

- [Users may expect script-first installs because JetBrains quickstart leads with scripts] -> Keep the official scripts in the catalog and document managed installs as additional supported lifecycle paths.
- [Script-installed Junie remains outside Quantex-managed update flows] -> Omit a fake self-update command and rely on Junie's documented automatic update-check behavior.
- [Homebrew naming could drift upstream again] -> Store the fully qualified tap formula path and keep the agent-catalog spec tied to the currently resolvable upstream tap repository.
