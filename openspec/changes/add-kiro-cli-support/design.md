# Design: Add Kiro CLI Support

## Decision

Add Kiro CLI as a script-install-only agent (no npm/bun packages available) with winget support on Windows. Kiro CLI auto-updates in the background, so no self-update command is exposed.

## Agent Definition

| Field | Value |
|---|---|
| name | `kiro` |
| lookupAliases | `['kiro-cli']` |
| displayName | `Kiro CLI` |
| homepage | `https://kiro.dev/cli/` |
| binaryName | `kiro-cli` |
| packages | (none) |
| selfUpdate | (none — auto-updates in background) |
| versionProbe | `kiro-cli --version` |

## Install Methods

| Platform | Method | Command |
|---|---|---|
| macOS | script | `curl -fsSL https://cli.kiro.dev/install \| bash` |
| Linux | script | `curl -fsSL https://cli.kiro.dev/install \| bash` |
| Windows | script | `irm 'https://cli.kiro.dev/install.ps1' \| iex` |
| Windows | winget | `Amazon.Kiro` |

## Rationale

- Kiro CLI is distributed as a standalone binary via platform-specific install scripts, not as an npm package.
- On Windows, winget provides an alternative managed install path.
- The binary name is `kiro-cli` (not `kiro`), matching the official documentation.
- Kiro CLI auto-updates silently in the background, so no `selfUpdate` field is needed. Users can disable auto-update via `kiro-cli settings "app.disableAutoupdates" "true"`.
