## Context

Tabnine CLI is a terminal-native AI coding agent distributed by Tabnine (codota). It is installed via a Node.js-based installer script fetched from the Tabnine console host. The installer downloads the binary to `~/.local/bin/tabnine` (macOS/Linux) or the user's PATH directory (Windows). Updates are handled by re-running the same installer script; Tabnine also auto-checks for updates on startup.

This change follows the established pattern used by other script-installed agents in the catalog (e.g., Cursor CLI, Kimi Code).

## Goals / Non-Goals

**Goals:**

- Add Tabnine CLI as a supported lifecycle agent with installation, version probing, and self-update metadata.
- Follow existing agent definition conventions exactly.

**Non-Goals:**

- Supporting npm/bun/brew managed install methods — Tabnine CLI does not publish an npm package or Homebrew formula.
- Handling the `TABNINE_HOST` environment variable — the installer defaults to `https://console.tabnine.com` which covers the public SaaS case; enterprise on-prem users can set the env var before running the script.

## Decisions

- **Install method**: Use `scriptInstall` for all platforms, matching the official Tabnine installation docs. The script commands include the default `TABNINE_HOST` (`https://console.tabnine.com`) inline so the command works without prior env var setup.
- **Self-update command**: Set to `['tabnine', 'update']` based on the documented auto-update behavior. If `tabnine update` is not a valid subcommand, the fallback is re-running the installer script.
- **Version probe**: Use `['tabnine', '--version']` which is the standard version flag per the quickstart docs.

## Risks / Trade-offs

- **Enterprise hosts**: The hardcoded `console.tabnine.com` in the script command means enterprise on-prem users would need to modify the command. This is acceptable because Quantex's install surface renders the command for users to see and adapt. → Mitigation: documented in the alias/description; enterprise users already know their host.
- **Node.js prerequisite**: Tabnine CLI requires Node.js 20+. The installer script will fail without it. → Mitigation: this is a prerequisite of Tabnine itself, not something Quantex needs to enforce beyond rendering the install command.
