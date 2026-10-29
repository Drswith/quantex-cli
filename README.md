# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Release][release-src]][release-href]
[![CI][ci-src]][ci-href]
[![Platforms][platforms-src]][release-href]
[![License][license-src]][license-href]

Install, inspect, update, uninstall, and run AI coding assistant CLIs from one agent-friendly command line.

**English** | [简体中文](./README.zh-CN.md)

</div>

Quantex is a lifecycle CLI for AI coding assistants and terminal coding agents, built for people and for agents. One `qtx` command installs, inspects, updates, uninstalls, and runs Codex CLI, Claude Code, Cursor CLI, OpenCode, Pi, and 17 more, with stable machine-readable output. `qtx` and `quantex` are the same command; this README uses the shorter one.

## Why Quantex

- One lifecycle surface for many agent CLIs: `install`, `info`, `resolve`, `update`, `uninstall`, `exec`.
- Built for scripts and agents: `--json`, `--non-interactive`, `--dry-run`, and `--timeout`, with documented error codes and exit codes.
- Tracks where each agent actually came from (npm, Bun, or an official install script), so `update --all` uses the recorded source instead of guessing from `PATH`.
- Verifies before it records: every install, update, and uninstall is checked against a fresh observation.
- A single native binary (about 3 MB) with no runtime to install, and a `quantex upgrade` that keeps it current.

## Install

Install the standalone binary. It has no runtime to install, and `qtx upgrade` replaces it in place.

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.ps1 | iex
```

The scripts install `quantex` and `qtx` into `~/.local/bin` (set `QUANTEX_INSTALL_DIR` to change it, or `QUANTEX_VERSION=v<version>` to pin a release) after checking the download against `SHA256SUMS.txt`.

Binaries for macOS (arm64, x64), Linux (arm64, x64, statically linked), and Windows (x64) are also attached to every [GitHub release](https://github.com/Drswith/quantex-cli/releases).

Other ways: npm and Bun install the same native binary through a per-platform package, and `qtx upgrade` then goes through that package manager.

```bash
npm install -g quantex-cli
```

```bash
bun add -g quantex-cli
```

Prereleases are published as GitHub prereleases (and, from the point npm publishing is turned on, to npm under the `beta` tag: `npm install -g quantex-cli@beta`); installs on the stable channel are never offered them.

## Quick start

Install agents and run one:

```bash
qtx install claude codex
qtx exec claude --install if-missing -- --help
```

Installing an agent that is already there succeeds without changing anything, so scripts can run `install` (or its alias `ensure`) every time:

```bash
qtx install codex --json
```

Inspect an agent and resolve its executable:

```bash
qtx info codex --json
qtx resolve codex --json
```

Update one agent, or everything Quantex manages:

```bash
qtx update claude
qtx update --all
```

Upgrade Quantex itself:

```bash
qtx upgrade --check
qtx upgrade
```

## Commands

| Command | Description |
|---|---|
| `qtx install <agent> [more...]` (`i`, `ensure`) | Install agents that are missing |
| `qtx update <agent>` (`u`), `qtx update --all [--managed]` | Update an agent, or every installed one |
| `qtx uninstall <agent>` (`rm`) | Uninstall an agent Quantex installed |
| `qtx list` (`ls`) | List supported agents and what is installed |
| `qtx info <agent>` (`inspect`) | Show an agent's details, state, and install methods |
| `qtx resolve <agent>` | Resolve the executable to launch |
| `qtx exec <agent> [--install never\|if-missing\|always] -- [args...]` | Run an agent with an explicit install policy |
| `qtx <agent> [args...]` | Run an agent, offering to install it when missing |
| `qtx doctor` | Diagnose the environment, with recovery steps |
| `qtx commands` | Show the stable command catalog |
| `qtx config [list\|get\|set\|reset] [key] [value]` | Read and change configuration |
| `qtx upgrade [--check] [--channel stable\|beta]` | Upgrade Quantex itself |

`qtx uninstall` acts on the install source Quantex recorded. It does not remove a separately installed copy that is still on `PATH`; `qtx info <agent> --json` shows which copy is which.

## Supported agents

| Agent | Run command | Description |
|---|---|---|
| Amp | `qtx amp` | Sourcegraph's frontier AI coding agent CLI |
| Antigravity CLI | `qtx antigravity` | Google's Antigravity terminal coding agent CLI |
| Claude Code | `qtx claude` | Anthropic's official AI coding assistant CLI |
| CodeBuddy Code | `qtx codebuddy` | Tencent's official AI coding assistant CLI |
| Codex CLI | `qtx codex` | OpenAI's official AI coding assistant CLI |
| Command Code | `qtx commandcode` | Command Code's AI coding assistant CLI |
| Crush | `qtx crush` | Charmbracelet's terminal AI coding agent CLI |
| Cursor CLI | `qtx cursor` | Cursor AI coding assistant CLI |
| DeepSeek Harness | `qtx dsh` | DeepSeek's official plugin-architecture agent harness CLI |
| Devin for Terminal | `qtx devin` | Cognition's local coding agent CLI |
| Droid | `qtx droid` | Factory AI software engineering agent CLI |
| GitHub Copilot CLI | `qtx copilot` | GitHub Copilot command-line tool |
| Grok Build | `qtx grok` | xAI's terminal coding agent CLI |
| Hermes Agent | `qtx hermes` | Nous Research's self-improving AI agent CLI |
| Kilo CLI | `qtx kilo` | Kilo's official AI coding assistant CLI |
| Kimi Code | `qtx kimi` | Moonshot AI's coding assistant CLI |
| MiMoCode | `qtx mimo` | Xiaomi's terminal-native AI coding assistant CLI |
| oh-my-pi (OMP) | `qtx omp` | oh-my-pi coding agent CLI |
| OpenClaw | `qtx openclaw` | OpenClaw's open-source AI agent runtime CLI |
| OpenCode | `qtx opencode` | Open-source AI coding CLI |
| Pi | `qtx pi` | Minimal and extensible terminal coding agent |
| Qoder CLI | `qtx qoder` | Qoder's official AI coding assistant CLI |

## For agents and automation

Quantex is a lifecycle tool, not a workflow orchestration platform. Agents that use it should install the Quantex skill, which teaches the command recipes and output contracts:

```bash
npx skills add Drswith/quantex-cli --skill quantex-cli -a codex -a claude-code -a opencode -y
```

Then discover the stable surface:

```bash
qtx commands --json
```

The contract an agent can rely on:

- `--json` prints one result envelope `{ action, ok, data, error, warnings, meta, target }`.
- With `--json`, stdout carries only the envelope. Logs, warnings, prompts, and installer and agent output go to stderr.
- `--non-interactive` never prompts (a needed confirmation becomes `INTERACTION_REQUIRED`); `--yes` accepts prompts; `--quiet` silences informational output.
- `--dry-run` reports what `install`, `update`, `uninstall`, `exec`, and `upgrade` would do, without doing it.
- `--timeout <duration>` (`500ms`, `30s`, `2m`) bounds a command; `--refresh` skips the version cache.
- `install`, `update`, and `uninstall` can be retried: one that has nothing left to do succeeds without changes.

| Exit code | Meaning |
|---|---|
| 0 | Success |
| 1 | `INSTALL_FAILED`, `UPDATE_FAILED`, `UNINSTALL_FAILED`, `UNINSTALL_UNMANAGED`, `UPGRADE_FAILED` (and `upgrade --check` when an update exists) |
| 2 | `INVALID_ARGUMENT`, including unknown options and missing arguments |
| 3 | `AGENT_NOT_FOUND` |
| 4 | `AGENT_NOT_INSTALLED` |
| 6 | `NETWORK_ERROR` |
| 7 | `INTERACTION_REQUIRED` |
| 8 | `MANUAL_ACTION_REQUIRED` |
| 9 | `RESOURCE_LOCKED` |
| 10 | `TIMEOUT` |
| 11 | `CANCELLED` |
| 12 | `STATE_READ_ERROR` |

`qtx exec` and `qtx <agent>` exit with the agent's own exit code once the agent runs.

## Configuration and state

Configuration lives in `~/.quantex/config.json` and is managed with `qtx config`:

```json
{
  "defaultPackageManager": "script",
  "networkTimeoutMs": 10000,
  "selfUpdateChannel": "stable"
}
```

- `defaultPackageManager` moves that installer first when an agent offers it: `script` (the default) is the agent's official installer, usually a native binary; `bun` or `npm` installs from the package registry instead. A script install is updated with the agent's own update command, and `qtx uninstall` only forgets it; bun and npm installs are updated and removed by Quantex.
- `networkTimeoutMs` bounds each version lookup; `selfUpdateChannel` is `stable` or `beta`.
- Updates of npm and Bun installs always go to the latest release.
- `selfUpdateRegistry` (unset by default) is the registry `qtx upgrade` uses for npm and Bun installs; `QTX_SELF_UPDATE_REGISTRY` overrides it for one run. It does not affect other projects.

Quantex records each agent's install source in `~/.quantex/state.json`. Version lookups are cached in `~/.quantex/cache/`, and locks live in `~/.quantex/locks/`.

## Upgrading from 1.x

Quantex 2 is a rewrite in Rust. It keeps the core 1.x command line, JSON fields, error codes, and `~/.quantex` files, and drops what few people used. A 1.x install upgrades with `qtx upgrade` and keeps its records. Going back to 1.x afterwards is not supported. On Windows, a 1.x standalone binary never completes a self-upgrade (it reports `updated` but nothing is replaced), so rerun `install.ps1` there. What changes:

- Removed: 11 rarely used agents, the Homebrew, winget, Cargo, Deno, mise, pip, and uv install routes, NDJSON output and `--output` (use `--json`), `--log-level`, `--idempotency-key`, `--no-cache` (use `--refresh`), `--run-id` and `meta.runId`, the `capabilities` and `schema` commands, and the config keys `npmBunUpdateStrategy`, `networkRetries`, and `versionCacheTtlHours`. `ensure` and `inspect` remain as aliases of `install` and `info`. [`CHANGELOG.md`](./CHANGELOG.md) has the full list.
- Argument errors (unknown option, missing argument, invalid value) exit with code 2 and, with `--json`, print an `INVALID_ARGUMENT` envelope. 1.x printed a plain error and exited 1.
- Human-readable output is not part of the contract; its layout differs from 1.x while meaning the same thing.
- The npm package no longer exports a JavaScript library, and `quantex-core` is not published from this line.
- A number of 1.x defects are fixed; [`contract/README.md`](./contract/README.md) lists each one.

## Contributing

Read [AGENTS.md](./AGENTS.md) first. The interface is defined in [`contract/`](./contract/README.md) and checked by the black-box suite in [`tests/contract/`](./tests/contract). Design records live in [`docs/design/`](./docs/design/), and [`docs/runbooks/releasing.md`](./docs/runbooks/releasing.md) describes how releases are built.

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## License

Apache-2.0

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat-square
[npm-version-href]: https://www.npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat-square
[npm-downloads-href]: https://www.npmjs.com/package/quantex-cli
[ci-src]: https://img.shields.io/github/actions/workflow/status/Drswith/quantex-cli/ci.yml?branch=main&style=flat-square&label=ci
[ci-href]: https://github.com/Drswith/quantex-cli/actions/workflows/ci.yml
[release-src]: https://img.shields.io/github/v/release/Drswith/quantex-cli?display_name=tag&sort=semver&style=flat-square
[release-href]: https://github.com/Drswith/quantex-cli/releases
[platforms-src]: https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-555?style=flat-square
[license-src]: https://img.shields.io/npm/l/quantex-cli?style=flat-square
[license-href]: ./LICENSE
