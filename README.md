# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

</div>

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

安装后可使用 `quantex` 或短别名 `qtx` 命令。

## 使用

### 安装 Agent

```bash
quantex install claude
# 或使用短别名
qtx i claude
```

### 更新 Agent

```bash
quantex update claude
quantex u claude

# 更新所有已安装的 agent
quantex update --all
```

`quantex update --all` 会优先使用 Quantex 记录的安装来源进行批量更新：

- 通过 Bun 安装的 agent 会合并为一条 `bun update -g ...`
- 通过 npm 安装的 agent 会合并为一条 `npm update -g ...`
- 通过脚本、二进制或尚未记录安装来源的 agent 会保留逐个更新

这意味着混合安装场景仍然安全，不会把通过其他方式安装的 agent 错误地塞进 Bun 或 npm 的批量更新命令。

### 卸载 Agent

```bash
quantex uninstall claude
quantex rm claude
```

### 列出所有 Agent

```bash
quantex list
quantex ls
```

### 查看 Agent 详情

```bash
quantex info claude
```

### 快捷启动 Agent

```bash
# 直接启动 agent（参数透传）
quantex claude --dangerously-skip-permissions

# 使用短别名启动
qtx claude --dangerously-skip-permissions

# 使用 agent 别名启动
quantex agent --help
```

### 配置管理

```bash
# 查看配置
quantex config

# 获取配置项
quantex config get defaultPackageManager

# 设置配置项
quantex config set defaultPackageManager npm

# 重置为默认配置
quantex config reset
```

### 环境检查

```bash
quantex doctor
```

## 配置

配置文件位于 `~/.quantex/config.json`，支持以下配置项：

```json
{
  "defaultPackageManager": "bun"
}
```

## 状态文件

除了配置文件外，Quantex 还会在 `~/.quantex/state.json` 中记录运行时状态，例如 agent 的实际安装来源。

这个状态文件主要用于：

- 让 `update --all` 按 Bun、npm、binary/script 分组更新
- 在混合安装场景下避免误用错误的更新方式
- 为后续的卸载、诊断和迁移能力保留扩展空间

如果某个 agent 是在旧版本 Quantex 中安装的，或者不是通过 Quantex 安装的，首次更新时可能仍会走逐个更新；一旦 Quantex 成功更新并记录来源，后续 `update --all` 就可以复用批量更新路径。

## 开发

```bash
bun install              # 安装依赖
bun run dev              # 开发运行
bun run test             # 运行测试
bun run test:watch       # 监听模式运行测试
bun run lint             # 代码检查
bun run typecheck        # 类型检查
bun run build            # 构建
```

## License

[MIT](./LICENSE) License © [Drswith](https://github.com/Drswith)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/quantex-cli
[bundle-src]: https://img.shields.io/bundlephobia/minzip/quantex-cli?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=quantex-cli
[license-src]: https://img.shields.io/github/license/Drswith/quantex-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Drswith/quantex-cli/blob/main/LICENSE
