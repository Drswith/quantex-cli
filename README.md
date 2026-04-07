# Silver CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

[English](#english) | [中文](#中文)

</div>

## 中文

Silver CLI 是一个统一的命令行工具，用于管理主流 AI 编程助手的 CLI 工具。

### 支持的 Agent

| Agent | 别名 | 描述 |
|-------|------|------|
| **Claude Code** | `claude` | Anthropic 官方 AI 编程助手 CLI |
| **Codex** | `codex` | OpenAI 官方 AI 编程助手 CLI |
| **GitHub Copilot** | `gh-copilot` | GitHub Copilot 命令行工具 |
| **Cursor** | - | Cursor AI 编程助手命令行工具 |
| **Droid** | `droid` | Factory AI 软件工程 Agent CLI |
| **Gemini** | - | Google 开源 AI 编程助手 CLI |
| **OpenCode** | `opencode` | 开源 AI 编程 CLI |
| **Pi** | `pi` | 极简可扩展的终端编程 Agent |

### 安装

```bash
# 使用 Bun
bun add -g silver-cli

# 使用 npm
npm i -g silver-cli
```

### 使用

#### 安装 Agent

```bash
# 安装指定 agent
silver install claude-code

# 简写
silver i claude-code
```

#### 更新 Agent

```bash
# 更新指定 agent
silver update claude-code

# 简写
silver u claude-code
```

#### 卸载 Agent

```bash
# 卸载指定 agent
silver uninstall claude-code

# 简写
silver rm claude-code
```

#### 列出所有 Agent

```bash
# 列出所有 agent
silver list

# 简写
silver ls
```

#### 查看 Agent 详情

```bash
# 查看 agent 信息
silver info claude-code
```

#### 快捷启动 Agent

```bash
# 直接启动 agent（参数透传）
silver claude-code --help

# 使用别名启动
silver claude --help
```

#### 配置管理

```bash
# 查看配置
silver config

# 编辑配置
silver config edit
```

#### 环境检查

```bash
# 运行环境检查
silver doctor
```

### 配置

配置文件位于 `~/.silver/config.json`，支持以下配置项：

```json
{
  "defaultPackageManager": "bun",
  "preferredInstallMethod": "bun",
  "autoUpdateCheck": true
}
```

### 开发

```bash
# 安装依赖
bun install

# 开发运行
bun run dev

# 运行测试
bun run test

# 运行测试（监听模式）
bun run test:watch

# 代码检查
bun run lint

# 类型检查
bun run typecheck

# 构建
bun run build
```

## English

Silver CLI is a unified command-line tool for managing CLI tools of mainstream AI programming assistants.

### Supported Agents

| Agent | Aliases | Description |
|-------|---------|-------------|
| **Claude Code** | `claude` | Anthropic official AI programming assistant CLI |
| **Codex** | `codex` | OpenAI official AI programming assistant CLI |
| **GitHub Copilot** | `gh-copilot` | GitHub Copilot command-line tool |
| **Cursor** | - | Cursor AI programming assistant CLI |
| **Droid** | `droid` | Factory AI software engineering Agent CLI |
| **Gemini** | - | Google open-source AI programming assistant CLI |
| **OpenCode** | `opencode` | Open-source AI programming CLI |
| **Pi** | `pi` | Minimal extensible terminal programming Agent |

### Installation

```bash
# Using Bun
bun add -g silver-cli

# Using npm
npm i -g silver-cli
```

### Usage

#### Install Agent

```bash
# Install specific agent
silver install claude-code

# Shorthand
silver i claude-code
```

#### Update Agent

```bash
# Update specific agent
silver update claude-code

# Shorthand
silver u claude-code
```

#### Uninstall Agent

```bash
# Uninstall specific agent
silver uninstall claude-code

# Shorthand
silver rm claude-code
```

#### List All Agents

```bash
# List all agents
silver list

# Shorthand
silver ls
```

#### View Agent Details

```bash
# View agent information
silver info claude-code
```

#### Quick Launch Agent

```bash
# Launch agent directly (arguments forwarded)
silver claude-code --help

# Launch using alias
silver claude --help
```

#### Config Management

```bash
# View configuration
silver config

# Edit configuration
silver config edit
```

#### Environment Check

```bash
# Run environment check
silver doctor
```

### Configuration

Configuration file located at `~/.silver/config.json`, supports the following options:

```json
{
  "defaultPackageManager": "bun",
  "preferredInstallMethod": "bun",
  "autoUpdateCheck": true
}
```

### Development

```bash
# Install dependencies
bun install

# Development run
bun run dev

# Run tests
bun run test

# Run tests (watch mode)
bun run test:watch

# Lint code
bun run lint

# Type check
bun run typecheck

# Build
bun run build
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
