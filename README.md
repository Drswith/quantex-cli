# Silver CLI

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
| **Claude Code** | `silver claude` | - | Anthropic 官方 AI 编程助手 CLI |
| **Codex** | `silver codex` | - | OpenAI 官方 AI 编程助手 CLI |
| **Copilot** | `silver copilot` | - | GitHub Copilot 命令行工具 |
| **Cursor** | `silver cursor` | `agent` | Cursor AI 编程助手命令行工具 |
| **Droid** | `silver droid` | - | Factory AI 软件工程 Agent CLI |
| **Gemini** | `silver gemini` | - | Google 开源 AI 编程助手 CLI |
| **OpenCode** | `silver opencode` | - | 开源 AI 编程 CLI |
| **Pi** | `silver pi` | - | 极简可扩展的终端编程 Agent |

## 安装

```bash
# 使用 Bun
bun add -g silver-cli

# 使用 npm
npm i -g silver-cli
```

## 使用

### 安装 Agent

```bash
silver install claude
silver i claude
```

### 更新 Agent

```bash
silver update claude
silver u claude

# 更新所有已安装的 agent
silver update --all
```

### 卸载 Agent

```bash
silver uninstall claude
silver rm claude
```

### 列出所有 Agent

```bash
silver list
silver ls
```

### 查看 Agent 详情

```bash
silver info claude
```

### 快捷启动 Agent

```bash
# 直接启动 agent（参数透传）
silver claude --dangerously-skip-permissions

# 使用别名启动
silver agent --help
```

### 配置管理

```bash
# 查看配置
silver config

# 获取配置项
silver config get defaultPackageManager

# 设置配置项
silver config set defaultPackageManager npm

# 重置为默认配置
silver config reset
```

### 环境检查

```bash
silver doctor
```

## 配置

配置文件位于 `~/.silver/config.json`，支持以下配置项：

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

[npm-version-src]: https://img.shields.io/npm/v/silver-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/silver-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/silver-cli?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/silver-cli
[bundle-src]: https://img.shields.io/bundlephobia/minzip/silver-cli?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=silver-cli
[license-src]: https://img.shields.io/github/license/Drswith/silver-cli.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Drswith/silver-cli/blob/main/LICENSE
