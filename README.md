# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

</div>

> 项目定位：Quantex 是 `human-friendly + agent-friendly` 的 `agent lifecycle CLI`。主线聚焦 agent 的安装、检查、确保可用、更新、卸载、能力发现与稳定执行契约，不把自身扩张为 workflow orchestration platform。

## 设计文档

- [Human + Agent 双模 CLI 设计](./HUMAN_AGENT_DUAL_MODE_CLI.md)
- [Human + Agent 双模 CLI Implementation Checklist / Issue Backlog](./HUMAN_AGENT_DUAL_MODE_CLI_IMPLEMENTATION_BACKLOG.md)

## 支持的 Agent

| Agent | 命令 | 别名 | 描述 |
|-------|------|------|------|
| **Claude Code** | `quantex claude` / `qtx claude` | - | Anthropic 官方 AI 编程助手 CLI |
| **Codex** | `quantex codex` / `qtx codex` | - | OpenAI 官方 AI 编程助手 CLI |
| **Copilot** | `quantex copilot` / `qtx copilot` | - | GitHub Copilot 命令行工具 |
| **Cursor** | `quantex cursor` / `qtx cursor` | `agent` | Cursor AI 编程助手命令行工具 |
| **Droid** | `quantex droid` / `qtx droid` | - | Factory AI 软件工程 Agent CLI |
| **Gemini** | `quantex gemini` / `qtx gemini` | - | Google 开源 AI 编程助手 CLI |
| **OpenCode** | `quantex opencode` / `qtx opencode` | - | 开源 AI 编程 CLI |
| **Pi** | `quantex pi` / `qtx pi` | - | 极简可扩展的终端编程 Agent |

## 安装

```bash
# 使用 Bun
bun add -g quantex-cli

# 使用 npm
npm i -g quantex-cli
```

也可以从 GitHub Releases 下载对应平台的独立二进制，或使用安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.ps1 | iex
```

安装后可使用 `quantex` 或短别名 `qtx` 命令。

## 使用

### 安装 Agent

```bash
quantex install claude
qtx i claude
```

### 确保 Agent 已安装

```bash
quantex ensure claude
```

`ensure` 是面向自动化和 agent 调用的幂等入口：

- 已安装则直接成功
- 未安装时才执行安装
- 配合 `--json` 时会返回 `changed` 字段，便于上层判断是否发生变更

### 更新 Agent

```bash
quantex update claude
quantex u claude

quantex update --all
```

`quantex update` 和 `quantex update --all` 现在共用同一套更新策略层：

- `managed`：优先按 Quantex 已记录的安装来源更新
- `self-update`：使用 agent 自带的更新命令
- `manual-hint`：不自动更新，只给出明确提示

`quantex update --all` 会优先使用 `~/.quantex/state.json` 里记录的实际安装来源进行批量更新：

- `bun` 会批量合并为一条 `bun update -g --latest ...`
- `npm` 会批量合并为一条 `npm install -g ...@latest`
- `brew`、`winget` 会按记录的安装器标识逐个更新
- `script`、`binary` 或仅在 PATH 中探测到但没有可自动更新能力的 agent 不会被错误并入托管更新命令

对于支持自更新的 agent，`list`、`info`、`update` 输出会明确显示 `command update` 或 `self-update`。

### 升级 Quantex CLI

```bash
quantex upgrade

# 只检查是否有更新
quantex upgrade --check

# 使用 beta channel
quantex upgrade --channel beta
```

当前自身升级支持：

- 通过 Bun 全局安装的 `quantex-cli`
- 通过 npm 全局安装的 `quantex-cli`
- 通过独立二进制安装的 `quantex`

Binary 自升级具备：

- release manifest 解析
- SHA256 checksum 校验
- 升级锁
- post-upgrade verify
- `.bak` 最小回滚
- Windows 延迟替换

如果升级失败，`upgrade` 和 `doctor` 都会给出与安装来源匹配的恢复方式。

### 卸载 Agent

```bash
quantex uninstall claude
quantex rm claude
```

### 列出所有 Agent

```bash
quantex list
qtx ls
```

`list` 会显示每个 agent 的安装状态、当前版本、更新方式和安装来源。例如：

- `managed update` 表示 Quantex 能按记录的安装器执行更新
- `command update` 表示当前 agent 支持自更新
- `manual update` 表示当前来源不支持自动更新
- `managed via bun (...)`、`managed via brew (...)` 表示有明确来源记录
- `detected in PATH` 表示命令存在，但不是由当前 Quantex 状态追踪到的安装

### 查看 Agent 详情

```bash
quantex info claude
```

`info` 会显示：

- 当前平台可用的安装方式
- 当前记录的安装来源与生命周期
- 当前版本和可检测到的最新版本
- agent 自带的自更新命令

### 查看 Agent 结构化状态

```bash
quantex inspect claude
quantex inspect claude --json
```

`inspect` 更偏 agent-friendly，会集中返回：

- 安装状态、版本、路径、来源
- 当前 update mode
- 当前平台可用安装方式
- `auto-install` / `self-update` / `runnable` 等能力摘要

### 快捷启动 Agent

```bash
quantex claude --dangerously-skip-permissions
qtx claude --dangerously-skip-permissions
quantex agent --help
```

如果 agent 未安装，Quantex 会提示是否先安装再启动。

### 以显式策略启动 Agent

```bash
quantex exec claude --install if-missing -- --dangerously-skip-permissions
quantex exec codex --install never -- --help
```

`exec` 是比快捷启动更适合自动化的入口：

- `--install never`：未安装时直接失败
- `--install if-missing`：缺失时自动安装再启动
- `--install always`：显式要求先满足安装前置，再启动

`--` 之后的参数会原样透传给下游 agent，避免与 Quantex 自己的参数冲突。

### 配置管理

```bash
quantex config
quantex config get defaultPackageManager
quantex config set defaultPackageManager npm
quantex config set npmBunUpdateStrategy respect-semver
quantex config set selfUpdateChannel beta
quantex config reset
```

### 环境检查

```bash
quantex doctor
```

`doctor` 会检查：

- `bun`、`npm`、`brew`、`winget` 是否可用
- Quantex CLI 自身的版本、安装来源、是否支持自动升级
- Quantex CLI 是否有新版本以及对应恢复方式
- 已安装 agent 的版本状态
- 当前环境是否缺少任何可用于托管安装/更新的安装器

### 查看能力探测结果

```bash
quantex capabilities
quantex capabilities --json
```

`capabilities` 和 `doctor` 的边界不同：

- `capabilities`：回答“当前环境能做什么”
- `doctor`：回答“当前哪里有问题，以及怎么修”

### 查看命令目录

```bash
quantex commands
quantex commands --json
```

`commands` 会返回当前支持的稳定命令、摘要以及常用 flag，适合作为上层 agent 做 command discovery 的入口。

### 查看输出 Schema

```bash
quantex schema
quantex schema inspect --json
```

`schema` 用来导出稳定命令的结构化输出定义，适合作为 agent 或 SDK 的类型参考。

## 配置

配置文件位于 `~/.quantex/config.json`，当前支持：

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

配置项说明：

- `defaultPackageManager`：控制托管安装器的优先尝试顺序
- `npmBunUpdateStrategy`：
  - `latest-major`：升级到 registry 最新版本，默认值
  - `respect-semver`：保留包管理器默认的 semver 更新语义
- `selfUpdateChannel`：Quantex CLI 自升级默认 channel，支持 `stable` / `beta`
- `networkRetries`：版本查询和 release 元数据请求重试次数
- `networkTimeoutMs`：网络请求超时时间
- `versionCacheTtlHours`：版本与 release 元数据缓存 TTL

## 状态文件

Quantex 会在 `~/.quantex/state.json` 中记录运行时状态，例如：

- agent 的实际安装来源
- Quantex CLI 自身的安装来源

这个状态文件主要用于：

- 让 `update --all` 能先生成更新计划，再按安装来源分组执行
- 避免混合安装场景下误用错误的更新方式
- 支撑 `list`、`info`、`doctor`、`upgrade` 的来源判断和恢复提示

## 开发

```bash
bun install
bun run dev
bun run test
bun run test:watch
bun run lint
bun run lint:fix
bun run typecheck
bun run build
bun run build:bin
bun run release:artifacts
```

`release:artifacts` 会统一生成并校验：

- `dist/bin/SHA256SUMS.txt`
- `dist/bin/manifest.json`

## License

[Apache License 2.0](./LICENSE) © [Drswith](https://github.com/Drswith)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/quantex-cli
[bundle-src]: https://img.shields.io/bundlephobia/minzip/quantex-cli?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=quantex-cli
[license-src]: https://img.shields.io/github/license/Drswith/quantex-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Drswith/quantex-cli/blob/main/LICENSE
