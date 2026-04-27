# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![GitHub stars][stars-src]][stars-href]
[![CI][ci-src]][ci-href]
[![Release][release-src]][release-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

统一管理 AI 编程助手 CLI 的安装、检查、更新、卸载与启动。

**简体中文** | [English](./README.en.md)

</div>

Quantex 是一个 `human-friendly + agent-friendly` 的 agent lifecycle CLI。它帮你把 Claude Code、Codex、Gemini、Kilo Code、Cursor、OpenCode 等 AI 编程助手的生命周期操作统一到一组稳定命令里：人可以直接用，自动化脚本和 coding agent 也可以用结构化输出可靠调用。

## 为什么用 Quantex

- 一个入口管理多个 AI agent：安装、确保可用、查询状态、更新、卸载、启动。
- 适合脚本和 agent 调用：支持 `--json`、`--output ndjson`、`--non-interactive`、`--dry-run` 等稳定契约。
- 记住真实安装来源：`update --all` 会优先按已记录来源分组更新，避免混合安装环境下误用更新方式。
- 支持 Quantex 自升级：Bun、npm、独立二进制安装来源都有对应升级路径。

## Agent 快速接入

如果你正在让 coding agent 使用 Quantex，可以先安装仓库里的 Quantex skill：

```bash
npx skills add Drswith/quantex-cli --skill quantex-cli -a codex -a claude-code -a opencode -y
```

只想先查看这个仓库暴露了哪些 skills：

```bash
npx skills add Drswith/quantex-cli --list
```

随后让 agent 发现 Quantex 的稳定命令和输出契约：

```bash
npm exec --yes --package quantex-cli -- quantex capabilities --json
npm exec --yes --package quantex-cli -- quantex commands --json
npm exec --yes --package quantex-cli -- quantex schema --json
```

如果 agent 正在这个仓库内参与开发，请把下面这段作为启动提示：

```text
Read AGENTS.md, openspec/README.md, and skills/quantex-cli/SKILL.md first.
For non-trivial changes, use the OpenSpec / OPSX workflow.
Before finishing, run bun run lint and bun run typecheck.
If command behavior changed, also run bun run test.
```

仓库内置的 Quantex skill 位于 [`skills/quantex-cli/`](./skills/quantex-cli/)。它可以通过 [skills.sh](https://skills.sh/) 的 `npx skills add` 从 GitHub 安装，但仍然以本仓库为发布源，不是单独的 npm package；安装和同步方式见 [skill 分发说明](./docs/skill-installation-and-distribution.md)。

## 安装

使用 Bun：

```bash
bun add -g quantex-cli
```

使用 npm：

```bash
npm i -g quantex-cli
```

也可以从 [GitHub Releases](https://github.com/Drswith/quantex-cli/releases) 下载独立二进制，或使用安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.ps1 | iex
```

安装后可以使用完整命令 `quantex`，也可以使用短别名 `qtx`。

## 快速开始

安装并启动一个 agent：

```bash
quantex install claude
quantex exec claude --install if-missing -- --help
```

确保 agent 可用，适合脚本或其他 agent 调用：

```bash
quantex ensure codex --json
```

查看 agent 状态和可执行入口：

```bash
quantex inspect codex --json
quantex resolve codex --json
```

更新单个 agent 或全部已安装 agent：

```bash
quantex update claude
quantex update --all
```

升级 Quantex 自身：

```bash
quantex upgrade
quantex upgrade --check
quantex upgrade --channel beta
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `quantex install <agent>` / `qtx i` | 安装 agent |
| `quantex ensure <agent>` | 幂等确保 agent 已安装 |
| `quantex update <agent>` / `qtx u` | 更新 agent |
| `quantex update --all` | 更新所有已安装 agent |
| `quantex uninstall <agent>` / `qtx rm` | 卸载 agent |
| `quantex list` / `qtx ls` | 列出所有支持的 agent |
| `quantex info <agent>` | 查看 agent 详情 |
| `quantex inspect <agent>` | 查看结构化状态 |
| `quantex resolve <agent>` | 解析可执行入口 |
| `quantex exec <agent> -- [args...]` | 以显式策略运行 agent |
| `quantex <agent> [args...]` | 快捷启动 agent |
| `quantex capabilities` | 查看当前环境能力 |
| `quantex commands` | 查看稳定命令目录 |
| `quantex schema` | 查看结构化输出 schema |
| `quantex config` | 管理配置 |
| `quantex doctor` | 检查环境和恢复建议 |

## 支持的 Agent

| Agent | 启动命令 | 描述 |
|-------|----------|------|
| Claude Code | `quantex claude` | Anthropic 官方 AI 编程助手 CLI |
| Codex CLI | `quantex codex` | OpenAI 官方 AI 编程助手 CLI |
| GitHub Copilot CLI | `quantex copilot` | GitHub Copilot 命令行工具 |
| Cursor CLI | `quantex cursor` | Cursor AI 编程助手命令行工具 |
| Droid | `quantex droid` | Factory AI 软件工程 Agent CLI |
| Gemini CLI | `quantex gemini` | Google 开源 AI 编程助手 CLI |
| Kilo Code CLI | `quantex kilo` | Kilo 官方 AI 编程助手 CLI |
| OpenCode | `quantex opencode` | 开源 AI 编程 CLI |
| Pi | `quantex pi` | 极简可扩展的终端编程 Agent |

`qtx` 是 `quantex` 的短别名，例如 `qtx codex`、`qtx ensure claude`。

## 面向自动化和 Agent

Quantex 的主线不是工作流编排平台，而是稳定的 agent lifecycle surface。自动化场景建议显式使用结构化参数：

```bash
quantex inspect claude --json --refresh
quantex install claude --json --dry-run
quantex exec claude --install if-missing --yes -- --help
```

常用契约：

- `--json` / `--output <human|json|ndjson>` 控制输出格式。
- `--non-interactive`、`--yes`、`--quiet` 适合 CI 和 agent 调用。
- `--dry-run` 用于预览安装或更新计划。
- `--refresh` / `--no-cache` 控制版本和 release 元数据缓存。
- `stdout` 用于结构化结果，`stderr` 用于日志、警告和底层安装器输出。

如果你正在为上层 agent 集成 Quantex，优先从这些命令发现能力和类型：

```bash
quantex capabilities --json
quantex commands --json
quantex schema --json
```

## 配置与状态

用户配置位于 `~/.quantex/config.json`：

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

运行时状态位于 `~/.quantex/state.json`。Quantex 会记录 agent 和自身的实际安装来源，用于 `update --all` 分组更新、`doctor` 恢复建议和 self upgrade 来源判断。

## 发布

Quantex 使用 release-please 维护 Release PR，发布说明以 GitHub Releases 为准：

- [GitHub Releases](https://github.com/Drswith/quantex-cli/releases)
- [docs/releases.md](./docs/releases.md)
- [CHANGELOG.md](./CHANGELOG.md)

## 维护者与 Agent 协作

如果你要参与开发或让 coding agent 在本仓库内工作，请从这些入口开始：

- [AGENTS.md](./AGENTS.md)：仓库级 agent 指令、架构和命令约定。
- [docs/README.md](./docs/README.md)：ADR、runbook、session、postmortem 等项目文档入口。
- [openspec/README.md](./openspec/README.md)：OpenSpec / OPSX 变更流程。
- [docs/github-collaboration.md](./docs/github-collaboration.md)：Issue、PR、Discussion 协作流程。
- [skills/quantex-cli/SKILL.md](./skills/quantex-cli/SKILL.md)：面向 agent 使用 Quantex 的 repo-native skill。

本地开发常用命令：

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
