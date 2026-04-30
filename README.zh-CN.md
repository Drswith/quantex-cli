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

[English](./README.md) | **简体中文**

</div>

Quantex 是一个 `human-friendly + agent-friendly` 的 agent lifecycle CLI。它帮你把 Amp、Claude Code、Codex、Gemini、Kilo Code、Cursor、OpenCode 等 AI 编程助手的生命周期操作统一到一组稳定命令里：人可以直接用，自动化脚本和 coding agent 也可以用结构化输出可靠调用。本文默认使用更短的 `qtx` 作为推荐入口，`quantex` 是完全等价的完整命令名。

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
npm exec --yes --package quantex-cli -- qtx capabilities --json
npm exec --yes --package quantex-cli -- qtx commands --json
npm exec --yes --package quantex-cli -- qtx schema --json
```

如果 agent 正在这个仓库内参与开发，请把下面这段作为启动提示：

```text
Activate Superpowers if available, then read AGENTS.md, openspec/README.md, skills/quantex-agent-runtime/SKILL.md, and skills/quantex-cli/SKILL.md.
For non-trivial changes, use OpenSpec through the Quantex agent runtime.
Before finishing, run bun run lint, bun run format:check, and bun run typecheck.
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

安装后推荐直接使用 `qtx`；如果你更偏好完整命令名，也可以使用完全等价的 `quantex`。

## 免安装试用

如果你已经有 Quantex 当前要求的运行时环境，可以先不做全局安装，直接试用只读命令：

```bash
bunx quantex-cli list
npx --yes --package quantex-cli qtx capabilities --json
npm exec --yes --package quantex-cli -- qtx inspect codex --json
pnpm --package=quantex-cli dlx qtx doctor
```

注意事项：

- 这些命令适合 `list`、`info`、`inspect`、`doctor`、`capabilities`、`commands`、`schema` 这类只读或发现型操作。
- 当前已发布包的 CLI 入口通过 `bun` 执行，所以即使走 `npx` / `npm exec` / `pnpm dlx`，运行环境里也仍然需要可用的 `bun`。
- `install`、`ensure`、`update`、`uninstall`、`upgrade` 这类会写状态或依赖已记录安装来源的操作，仍然建议先按上面的方式正常安装再执行。

## 快速开始

安装并启动一个 agent：

```bash
qtx install claude
qtx exec claude --install if-missing -- --help
```

确保 agent 可用，适合脚本或其他 agent 调用：

```bash
qtx ensure codex --json
```

查看 agent 状态和可执行入口：

```bash
qtx inspect codex --json
qtx resolve codex --json
```

更新单个 agent 或全部已安装 agent：

```bash
qtx update claude
qtx update --all
```

升级 Quantex 自身：

```bash
qtx upgrade
qtx upgrade --check
qtx upgrade --channel beta
```

提示：`qtx upgrade` 会跟随当前 Bun/npm 自升级实际使用的 registry。若你使用镜像源，镜像未同步最新发布时，当前源可安装版本可能会暂时落后于官方 npm。此时可稍后重试，或单独设置 `selfUpdateRegistry` / `QTX_SELF_UPDATE_REGISTRY` 让 Quantex 自升级使用不同的 registry，而不影响其他项目。

## 常用命令

| 推荐命令 | 等价长命令 | 作用 |
|------|------|------|
| `qtx i <agent>` | `quantex install <agent>` | 安装 agent |
| `qtx ensure <agent>` | `quantex ensure <agent>` | 幂等确保 agent 已安装 |
| `qtx u <agent>` | `quantex update <agent>` | 更新 agent |
| `qtx update --all` | `quantex update --all` | 更新所有已安装 agent |
| `qtx rm <agent>` | `quantex uninstall <agent>` | 卸载 agent |
| `qtx ls` | `quantex list` | 列出所有支持的 agent |
| `qtx info <agent>` | `quantex info <agent>` | 查看 agent 详情 |
| `qtx inspect <agent>` | `quantex inspect <agent>` | 查看结构化状态 |
| `qtx resolve <agent>` | `quantex resolve <agent>` | 解析可执行入口 |
| `qtx exec <agent> -- [args...]` | `quantex exec <agent> -- [args...]` | 以显式策略运行 agent |
| `qtx <agent> [args...]` | `quantex <agent> [args...]` | 快捷启动 agent |
| `qtx capabilities` | `quantex capabilities` | 查看当前环境能力 |
| `qtx commands` | `quantex commands` | 查看稳定命令目录 |
| `qtx schema` | `quantex schema` | 查看结构化输出 schema |
| `qtx config` | `quantex config` | 管理配置 |
| `qtx doctor` | `quantex doctor` | 检查环境和恢复建议 |

## 支持的 Agent

| Agent | 启动命令 | 描述 |
|-------|----------|------|
| Auggie CLI | `qtx auggie` | Augment 官方终端编程 Agent CLI |
| Autohand Code CLI | `qtx autohand` | Autohand 官方自主终端编程 Agent CLI |
| Amp | `qtx amp` | Sourcegraph 前沿 AI 编程 Agent CLI |
| Claude Code | `qtx claude` | Anthropic 官方 AI 编程助手 CLI |
| CodeBuddy Code | `qtx codebuddy` | 腾讯官方 AI 编程助手 CLI |
| Codex CLI | `qtx codex` | OpenAI 官方 AI 编程助手 CLI |
| Crush | `qtx crush` | Charmbracelet 终端 AI 编程 Agent CLI |
| Cursor CLI | `qtx cursor` | Cursor AI 编程助手命令行工具 |
| Devin for Terminal | `qtx devin` | Cognition 本地编程 Agent CLI |
| Droid | `qtx droid` | Factory AI 软件工程 Agent CLI |
| ForgeCode | `qtx forgecode` | Antinomy AI 编程助手 CLI |
| Gemini CLI | `qtx gemini` | Google 开源 AI 编程助手 CLI |
| GitHub Copilot CLI | `qtx copilot` | GitHub Copilot 命令行工具 |
| Goose | `qtx goose` | Block 开源可扩展 AI Agent CLI |
| Junie CLI | `qtx junie` | JetBrains 官方 AI 编程 Agent CLI |
| Kilo CLI | `qtx kilo` | Kilo 官方 AI 编程助手 CLI |
| Kimi Code | `qtx kimi` | Moonshot AI 编程助手 CLI |
| Kiro CLI | `qtx kiro` | Amazon AI 编程 Agent CLI |
| Mistral Vibe | `qtx vibe` | Mistral 开源终端编程助手 |
| OpenHands CLI | `qtx openhands` | OpenHands 开源软件开发 Agent CLI |
| OpenCode | `qtx opencode` | 开源 AI 编程 CLI |
| Pi | `qtx pi` | 极简可扩展的终端编程 Agent |
| Qoder CLI | `qtx qoder` | Qoder 官方 AI 编程助手 CLI |
| Qwen Code | `qtx qwen` | Qwen AI 编程助手 CLI |

如果你更偏好显式长命令，上表里的 `qtx` 都可以直接替换成 `quantex`。

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
  "selfUpdateRegistry": "https://registry.npmjs.org",
  "networkRetries": 2,
  "networkTimeoutMs": 10000,
  "versionCacheTtlHours": 6
}
```

`selfUpdateRegistry` 只影响 Quantex 自身通过 Bun/npm 执行 `qtx upgrade` 的 registry 选择，不会修改你其他项目的默认安装源。一次性覆盖可使用环境变量 `QTX_SELF_UPDATE_REGISTRY`。

运行时状态位于 `~/.quantex/state.json`。Quantex 会记录 agent 和自身的实际安装来源，用于 `update --all` 分组更新、`doctor` 恢复建议和 self upgrade 来源判断。

## 发布

Quantex 使用 release-please 维护 Release PR，发布说明以 GitHub Releases 为准：

- [GitHub Releases](https://github.com/Drswith/quantex-cli/releases)
- [docs/releases.md](./docs/releases.md)
- [CHANGELOG.md](./CHANGELOG.md)

## 维护者与 Agent 协作

如果你要参与开发或让 coding agent 在本仓库内工作，请从这些入口开始：

- [AGENTS.md](./AGENTS.md)：仓库级 agent 执行手册，包含流程守卫、验证门槛和 trigger-based pointers。
- [docs/README.md](./docs/README.md)：ADR、runbook、session、postmortem 等项目文档入口。
- [openspec/README.md](./openspec/README.md)：OpenSpec / OPSX 变更流程。
- [docs/github-collaboration.md](./docs/github-collaboration.md)：Issue、PR、Discussion 协作流程。
- [skills/quantex-cli/SKILL.md](./skills/quantex-cli/SKILL.md)：面向 agent 使用 Quantex 的 repo-native skill。

本地开发常用命令：

```bash
bun install
bun run dev
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
```

## License

Apache-2.0

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat-square
[npm-version-href]: https://www.npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat-square
[npm-downloads-href]: https://www.npmjs.com/package/quantex-cli
[stars-src]: https://img.shields.io/github/stars/Drswith/quantex-cli?style=flat-square
[stars-href]: https://github.com/Drswith/quantex-cli/stargazers
[ci-src]: https://img.shields.io/github/actions/workflow/status/Drswith/quantex-cli/ci.yml?branch=main&style=flat-square&label=ci
[ci-href]: https://github.com/Drswith/quantex-cli/actions/workflows/ci.yml
[release-src]: https://img.shields.io/github/v/release/Drswith/quantex-cli?display_name=tag&sort=semver&style=flat-square
[release-href]: https://github.com/Drswith/quantex-cli/releases
[bundle-src]: https://img.shields.io/bundlephobia/minzip/quantex-cli?style=flat-square
[bundle-href]: https://bundlephobia.com/package/quantex-cli
[license-src]: https://img.shields.io/npm/l/quantex-cli?style=flat-square
[license-href]: ./LICENSE
