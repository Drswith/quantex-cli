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
bun add -g quantex

# 使用 npm
npm i -g quantex
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

[npm-version-src]: https://img.shields.io/npm/v/quantex?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/quantex
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/quantex
[bundle-src]: https://img.shields.io/bundlephobia/minzip/quantex?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=quantex
[license-src]: https://img.shields.io/github/license/Drswith/quantex-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Drswith/quantex-cli/blob/main/LICENSE
