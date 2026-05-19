# Design: Add Autohand Code CLI support

## Decision

Add Autohand Code CLI as a script-installed lifecycle agent on Windows, macOS, and Linux, using `autohand` as the canonical Quantex slug and executable name, `autohand-cli` as a package-style lookup alias, and `autohand --version` for version probing.

## Agent Definition

| Field | Value |
|---|---|
| name | `autohand` |
| lookupAliases | `autohand-cli` |
| displayName | `Autohand Code CLI` |
| homepage | `https://autohand.ai/cli/` |
| packages | `autohand-cli` |
| binaryName | `autohand` |
| selfUpdate | none |
| versionProbe | `autohand --version` |

## Install Methods

| Platform | Method | Command |
|---|---|---|
| Windows | script | `iwr -useb https://autohand.ai/install.ps1 \| iex` |
| macOS | script | `curl -fsSL https://autohand.ai/install.sh \| bash` |
| Linux | script | `curl -fsSL https://autohand.ai/install.sh \| bash` |

## Rationale

- Upstream README and installer sources document the `autohand` executable, `autohand --version`, and official shell / PowerShell installers hosted at `autohand.ai`.
- The published package metadata uses the npm package name `autohand-cli`, so adding it as package metadata and a lookup alias helps users resolve the agent with either the executable-oriented or package-oriented spelling.
- Although Autohand is published on npm, the upstream user-facing install docs currently center the release-binary installer scripts instead of npm/bun flows. Quantex should not advertise managed install methods that the upstream product docs are not currently treating as the primary supported lifecycle path.
- The upstream install scripts fetch the latest release assets, but the docs do not currently expose a dedicated `autohand update` subcommand. Quantex should therefore record manual/script update behavior rather than a self-update command.

## Non-Goals

- Model Autohand authentication, provider setup, skill authoring, or session management behavior in Quantex metadata
- Add managed npm or bun install methods without explicit upstream install guidance
- Expand Quantex's catalog schema to capture installer channels, release-asset naming, or bundled ripgrep behavior
