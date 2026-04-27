# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![GitHub stars][stars-src]][stars-href]
[![CI][ci-src]][ci-href]
[![Release][release-src]][release-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

Manage AI coding assistant CLIs from one lifecycle-focused command line.

[简体中文](./README.md) | **English**

</div>

Quantex is a `human-friendly + agent-friendly` lifecycle CLI for AI coding agents. It gives Claude Code, Codex, Gemini, Cursor, OpenCode, and other assistant CLIs a shared surface for installation, inspection, updates, removal, execution, and machine-readable automation.

## Why Quantex

- Manage multiple AI agents from one CLI: install, ensure, inspect, update, uninstall, and run.
- Designed for scripts and coding agents: stable `--json`, `--output ndjson`, `--non-interactive`, and `--dry-run` contracts.
- Tracks real install sources: `update --all` groups updates by recorded source instead of guessing from PATH alone.
- Supports Quantex self-upgrade across Bun, npm, and standalone binary installs.

## Agent Quick Start

If you are using a coding agent with Quantex, start by installing the repo-provided Quantex skill:

```bash
npx skills add Drswith/quantex-cli --skill quantex-cli -a codex -a claude-code -a opencode -y
```

To preview the skills exposed by this repository:

```bash
npx skills add Drswith/quantex-cli --list
```

Then let the agent discover Quantex's stable commands and output contracts:

```bash
npm exec --yes --package quantex-cli -- quantex capabilities --json
npm exec --yes --package quantex-cli -- quantex commands --json
npm exec --yes --package quantex-cli -- quantex schema --json
```

If the agent is contributing inside this repository, use this as the bootstrap prompt:

```text
Read AGENTS.md, openspec/README.md, and skills/quantex-cli/SKILL.md first.
For non-trivial changes, use the OpenSpec / OPSX workflow.
Before finishing, run bun run lint and bun run typecheck.
If command behavior changed, also run bun run test.
```

The repo-local Quantex skill lives in [`skills/quantex-cli/`](./skills/quantex-cli/). It can be installed from GitHub through [skills.sh](https://skills.sh/) with `npx skills add`, but this repository remains the publishing source; it is not a separate npm package. See the [skill distribution notes](./docs/skill-installation-and-distribution.md) for installation and sync options.

## Install

With Bun:

```bash
bun add -g quantex-cli
```

With npm:

```bash
npm i -g quantex-cli
```

You can also download standalone binaries from [GitHub Releases](https://github.com/Drswith/quantex-cli/releases), or use the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.ps1 | iex
```

After installation, use `quantex` or its short alias `qtx`.

## Quick Start

Install and run an agent:

```bash
quantex install claude
quantex exec claude --install if-missing -- --help
```

Ensure an agent is available, which is useful for scripts and other agents:

```bash
quantex ensure codex --json
```

Inspect agent state and resolve its executable:

```bash
quantex inspect codex --json
quantex resolve codex --json
```

Update one agent or all installed agents:

```bash
quantex update claude
quantex update --all
```

Upgrade Quantex itself:

```bash
quantex upgrade
quantex upgrade --check
quantex upgrade --channel beta
```

## Common Commands

| Command | Description |
|---------|-------------|
| `quantex install <agent>` / `qtx i` | Install an agent |
| `quantex ensure <agent>` | Idempotently ensure an agent is installed |
| `quantex update <agent>` / `qtx u` | Update an agent |
| `quantex update --all` | Update all installed agents |
| `quantex uninstall <agent>` / `qtx rm` | Uninstall an agent |
| `quantex list` / `qtx ls` | List supported agents |
| `quantex info <agent>` | Show agent details |
| `quantex inspect <agent>` | Return structured agent state |
| `quantex resolve <agent>` | Resolve the executable entrypoint |
| `quantex exec <agent> -- [args...]` | Run an agent with explicit policy |
| `quantex <agent> [args...]` | Shortcut-run an agent |
| `quantex capabilities` | Show environment capabilities |
| `quantex commands` | Show the stable command catalog |
| `quantex schema` | Show structured output schemas |
| `quantex config` | Manage configuration |
| `quantex doctor` | Diagnose environment and recovery guidance |

## Supported Agents

| Agent | Run Command | Description |
|-------|-------------|-------------|
| Claude Code | `quantex claude` | Anthropic's official AI coding assistant CLI |
| Codex CLI | `quantex codex` | OpenAI's official AI coding assistant CLI |
| GitHub Copilot CLI | `quantex copilot` | GitHub Copilot command-line tool |
| Cursor CLI | `quantex cursor` | Cursor AI coding assistant CLI |
| Droid | `quantex droid` | Factory AI software engineering agent CLI |
| Gemini CLI | `quantex gemini` | Google's open-source AI coding assistant CLI |
| OpenCode | `quantex opencode` | Open-source AI coding CLI |
| Pi | `quantex pi` | Minimal and extensible terminal coding agent |

`qtx` is the short alias for `quantex`, for example `qtx codex` or `qtx ensure claude`.

## Automation And Agents

Quantex is not a workflow orchestration platform. Its core job is to provide a stable lifecycle surface for AI coding assistant CLIs. For automation, prefer explicit structured flags:

```bash
quantex inspect claude --json --refresh
quantex install claude --json --dry-run
quantex exec claude --install if-missing --yes -- --help
```

Useful contracts:

- `--json` / `--output <human|json|ndjson>` controls output format.
- `--non-interactive`, `--yes`, and `--quiet` are designed for CI and agent calls.
- `--dry-run` previews install or update plans.
- `--refresh` / `--no-cache` controls version and release metadata caches.
- `stdout` is reserved for structured results; `stderr` carries logs, warnings, and underlying installer output.

For upper-layer agent integrations, start with capability and schema discovery:

```bash
quantex capabilities --json
quantex commands --json
quantex schema --json
```

## Configuration And State

User configuration lives at `~/.quantex/config.json`:

```json
{
  "defaultPackageManager": "bun",
  "npmBunUpdateStrategy": "latest-major",
  "selfUpdateChannel": "stable",
  "networkRetries": 2,
  "networkTimeoutMs": 10000,
  "versionCacheTtlHours": 6
}
```

Runtime state lives at `~/.quantex/state.json`. Quantex records the actual install source for agents and itself, which powers grouped `update --all` execution, `doctor` recovery guidance, and self-upgrade source detection.

## Releases

Quantex uses release-please Release PRs. GitHub Releases are the canonical release notes:

- [GitHub Releases](https://github.com/Drswith/quantex-cli/releases)
- [docs/releases.md](./docs/releases.md)
- [CHANGELOG.md](./CHANGELOG.md)

## Maintainers And Agent Collaboration

If you are contributing to this repository or letting a coding agent work here, start from these entry points:

- [AGENTS.md](./AGENTS.md): repository-level agent instructions, architecture, and command conventions.
- [docs/README.md](./docs/README.md): project docs for ADRs, runbooks, sessions, and postmortems.
- [openspec/README.md](./openspec/README.md): OpenSpec / OPSX change workflow.
- [docs/github-collaboration.md](./docs/github-collaboration.md): Issue, PR, and Discussion collaboration flow.
- [skills/quantex-cli/SKILL.md](./skills/quantex-cli/SKILL.md): repo-native skill for agents using Quantex.

Common local development commands:

```bash
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run build
```

## License

[Apache License 2.0](./LICENSE) © [Drswith](https://github.com/Drswith)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/quantex-cli
[stars-src]: https://img.shields.io/github/stars/Drswith/quantex-cli?style=flat&colorA=080f12&colorB=f2c94c
[stars-href]: https://github.com/Drswith/quantex-cli/stargazers
[ci-src]: https://img.shields.io/github/actions/workflow/status/Drswith/quantex-cli/ci.yml?branch=main&style=flat&colorA=080f12&label=CI
[ci-href]: https://github.com/Drswith/quantex-cli/actions/workflows/ci.yml
[release-src]: https://img.shields.io/github/actions/workflow/status/Drswith/quantex-cli/release.yml?branch=main&style=flat&colorA=080f12&label=release
[release-href]: https://github.com/Drswith/quantex-cli/actions/workflows/release.yml
[bundle-src]: https://img.shields.io/bundlephobia/minzip/quantex-cli?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=quantex-cli
[license-src]: https://img.shields.io/github/license/Drswith/quantex-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Drswith/quantex-cli/blob/main/LICENSE
