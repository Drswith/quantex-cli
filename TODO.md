# Quantex CLI - AI Agent CLI 管理工具

## 项目简介

一个统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

## 技术栈

- **Runtime**: [Bun](https://bun.sh) — 包管理、脚本执行、运行时
- **Language**: TypeScript (strict mode)
- **Build**: [tsdown](https://github.com/nicepkg/tsdown) — 基于 rolldown 的打包工具
- **Test**: [Vitest](https://vitest.dev) — Vite 生态测试框架
- **Lint**: @antfu/eslint-config

## 支持的 AI Agent

| Agent | name | npm 包名 | lookupAliases | binaryName |
|-------|------|------|------|------------|
| Claude Code | `claude` | `@anthropic-ai/claude-code` | - | `claude` |
| Codex CLI | `codex` | `@openai/codex` | - | `codex` |
| Copilot | `copilot` | `@github/copilot` | - | `copilot` |
| Cursor | `cursor` | - | `agent` | `agent` |
| Droid | `droid` | `droid` | - | `droid` |
| Gemini | `gemini` | `@google/gemini-cli` | - | `gemini` |
| OpenCode | `opencode` | `opencode-ai` | - | `opencode` |
| Pi | `pi` | `@mariozechner/pi-coding-agent` | - | `pi` |

## 配置系统

- 配置文件路径: `~/.quantex/config.json`
- 状态文件路径: `~/.quantex/state.json`
- 使用 [c12](https://unjs.io/packages/c12) 实现配置加载，支持:
  - 默认配置（内置）
  - 用户配置（`~/.quantex/config.json`）
  - 环境变量覆盖
  - 配置合并

### 配置文件结构

```json
{
  "defaultPackageManager": "bun"
}
```

### 状态文件结构

```json
{
  "installedAgents": {
    "claude": {
      "agentName": "claude",
      "installType": "bun",
      "packageName": "@anthropic-ai/claude-code",
      "command": "bun add -g @anthropic-ai/claude-code"
    }
  }
}
```

## 安装与更新方式

每个 Agent 支持一组安装方式，默认按定义顺序回退；如果设置了 `defaultPackageManager`，则匹配的托管安装器会被优先尝试。

### 1. bun
```bash
bun add -g @anthropic-ai/claude-code
```

### 2. npm
```bash
npm i -g @anthropic-ai/claude-code
```

### 3. 二进制脚本（平台特定）

| Agent | Windows | macOS | Linux |
|-------|---------|-------|-------|
| Claude Code | `irm https://claude-setup.com/install.ps1 \| iex` | `brew install --cask claude-code` | `curl -fsSL https://claude-setup.com/install.sh \| sh` |
| Codex | npm/bun | npm/bun | npm/bun |
| OpenCode | npm/bun | npm/bun | npm/bun |

安装成功后，Quantex 会把实际采用的安装方式写入 `~/.quantex/state.json`。

`quantex update --all` 的行为：

- 已记录为 `bun` 的 agent 会合并成一条 `bun update -g ...`
- 已记录为 `npm` 的 agent 会合并成一条 `npm update -g ...`
- `brew`、`winget` 会按记录的安装器标识逐个更新
- `binary`、脚本安装或未记录来源的 agent 不会被自动更新
- 混合安装场景下不会把其他来源的 agent 错误并入 Bun/npm 批量命令

## CLI 命令设计

### 基础命令

```
quantex                    # 显示帮助信息
quantex --version          # 显示版本号
quantex help <command>     # 显示命令帮助
```

### Agent 管理

```
quantex install <agent>    # 安装指定 agent（别名: quantex i）
quantex update <agent>     # 更新指定 agent（别名: quantex u）
quantex update --all       # 更新所有已安装的 agent，按安装来源分组批量更新
quantex uninstall <agent>  # 卸载指定 agent（别名: quantex rm）
quantex list               # 列出所有支持的 agent 及状态（别名: quantex ls）
quantex info <agent>       # 查看 agent 详细信息（版本、安装方式等）
```

### 配置管理

```
quantex config             # 显示当前配置
quantex config set <key> <value>   # 设置配置项
quantex config get <key>           # 获取配置项
quantex config reset               # 重置为默认配置
```

### 快捷启动 Agent

```
quantex <agent> [args...]  # 直接启动 agent，透传所有参数
```

示例:
```bash
quantex claude --dangerously-skip-permissions
quantex codex --model o4-mini
quantex opencode
quantex agent              # 即 cursor
```

行为规则:
- 如果第一个参数匹配已注册的 agent 名称或 lookup alias，则作为代理启动该 agent
- 后续所有参数原样透传给 agent 进程（`stdio: inherit`）
- agent 未安装时，提示是否自动安装后再启动
- 如果第一个参数不匹配任何 agent，则走正常的 CLI 命令路由

### 其他

```
quantex doctor             # 检查环境（bun/npm/node 版本、已安装 agent 等）
quantex which <agent>      # 查看 agent 可执行文件路径（未实现）
```

## 技术架构

### 依赖库

| 库 | 用途 |
|----|------|
| [commander](https://github.com/tj/commander.js) | CLI 框架（最成熟，生态最大） |
| [c12](https://unjs.io/packages/c12) | 配置文件管理 |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | 终端彩色输出（极轻量） |
| [prompts](https://github.com/terkelg/prompts) | 交互式提示（安装确认等） |

### 目录结构

```
src/
├── index.ts              # 入口（导出核心 API）
├── cli.ts                # CLI 入口（commander 定义命令）
├── commands/             # CLI 命令实现
│   ├── install.ts
│   ├── update.ts
│   ├── uninstall.ts
│   ├── list.ts
│   ├── info.ts
│   ├── run.ts            # 快捷启动 agent（透传参数）
│   ├── config.ts
│   └── doctor.ts
├── agents/               # Agent catalog 与静态定义模型
│   ├── index.ts
│   ├── types.ts
│   ├── methods.ts
│   └── definitions/
│       ├── claude.ts
│       ├── codex.ts
│       ├── copilot.ts
│       ├── cursor.ts
│       ├── droid.ts
│       ├── gemini.ts
│       ├── opencode.ts
│       └── pi.ts
├── inspection/           # Agent 运行期探测
│   ├── index.ts
│   └── agents.ts
├── package-manager/      # 包管理器抽象
│   ├── index.ts
│   ├── installers.ts
│   ├── capabilities.ts
│   ├── bun.ts
│   ├── npm.ts
│   ├── brew.ts
│   ├── winget.ts
│   └── binary.ts
├── planning/             # 更新计划生成
│   ├── index.ts
│   └── updates.ts
├── services/             # Application service 层
│   ├── index.ts
│   ├── agents.ts
│   └── update.ts
├── state/                # 运行时状态导出
│   └── index.ts
├── state.ts              # 状态模型与持久化实现
├── config/               # 配置管理
│   ├── default.ts        # 默认配置
│   └── index.ts          # 配置加载（c12）
└── utils/                # 工具函数
    ├── detect.ts         # 环境检测（OS、包管理器可用性）
    ├── exec.ts           # 命令执行封装
    ├── install.ts        # 安装来源与展示辅助
    └── version.ts        # 版本查询与比较
```

### Agent 类型定义

```typescript
type Platform = 'windows' | 'macos' | 'linux'
type ManagedInstallType = 'bun' | 'npm' | 'brew' | 'winget'
type InstallType = ManagedInstallType | 'script' | 'binary'
type PackageTargetKind = 'package' | 'cask' | 'id'

interface InstallMethod {
  type: InstallType
  command?: string
  packageName?: string
  packageTargetKind?: PackageTargetKind
}

interface AgentDefinition {
  name: string                 // canonical id
  lookupAliases?: string[]     // 额外可解析名称，如 ["agent"]
  displayName: string
  description: string
  homepage: string
  packages?: {
    npm?: string               // npm 包名
  }
  platforms: Partial<Record<Platform, InstallMethod[]>>
  binaryName: string           // 安装后的实际可执行文件名
}
```

补充约定：

- `packages.npm` 专指 npm 包名
- `InstallMethod.packageName` 是安装器专用标识：npm/bun 用包名，brew 用 formula/cask 标识，winget 用 package ID
- `name`、`lookupAliases`、`binaryName` 的职责分离

## 开发计划

### Phase 1 - 基础框架
- [x] 初始化 CLI 框架（commander）
- [x] `package.json` 添加 `bin` 字段指向 CLI 入口
- [x] 定义 Agent 类型与注册表
- [x] 实现配置系统（c12）
- [x] 实现运行时状态系统（安装来源记录）
- [x] 实现环境检测（OS、bun/npm 可用性）
- [x] 实现 `quantex list` 命令

### Phase 2 - 核心功能
- [x] 实现包管理器抽象层（bun/npm/binary）
- [x] 实现 `quantex install <agent>` 命令
- [x] 实现 `quantex update <agent>` 命令
- [x] 实现 `quantex update --all` 按安装来源分组批量更新
- [x] 实现 `quantex uninstall <agent>` 命令
- [x] 实现 `quantex info <agent>` 命令
- [x] 实现 `quantex <agent> [args...]` 快捷启动（参数透传、未安装提示）

### Phase 3 - 体验优化
- [x] 实现 `quantex doctor` 环境检查
- [x] 实现 `quantex config` 配置管理
- [x] 彩色输出与交互式提示
- [ ] 进度条与安装动画
- [ ] 错误处理与友好提示

### Phase 4 - 发布与完善
- [ ] 完善测试覆盖率
- [ ] CI/CD 自动发布（GitHub Actions）
- [x] 编写 README 与使用文档
- [ ] npm 发布
- [ ] 二进制产物构建（`bun build --compile`）

## 二进制构建

使用 `bun build --compile` 交叉编译为独立可执行文件，无需目标机器安装运行时。

### 支持的 Target

| Target | 平台 | 架构 | 说明 |
|--------|------|------|------|
| `bun-linux-x64` | Linux | x64 | 默认 |
| `bun-linux-x64-baseline` | Linux | x64 | 兼容 2013 年前的 CPU (nehalem) |
| `bun-linux-x64-modern` | Linux | x64 | 2013+ CPU (haswell)，更快 |
| `bun-linux-arm64` | Linux | ARM64 | Graviton / Raspberry Pi |
| `bun-windows-x64` | Windows | x64 | 默认 |
| `bun-windows-x64-baseline` | Windows | x64 | 兼容旧 CPU |
| `bun-windows-x64-modern` | Windows | x64 | 更快 |
| `bun-windows-arm64` | Windows | ARM64 | |
| `bun-darwin-arm64` | macOS | ARM64 | Apple Silicon |
| `bun-darwin-x64` | macOS | x64 | Intel Mac |

### 构建命令

```bash
# 构建全部平台
bun run build:bin

# 单平台构建
bun build --compile ./src/cli.ts --target=bun-linux-x64-modern --outfile=dist/quantex-linux-x64
bun build --compile ./src/cli.ts --target=bun-darwin-arm64 --outfile=dist/quantex-darwin-arm64
bun build --compile ./src/cli.ts --target=bun-windows-x64-modern --outfile=dist/quantex-windows-x64
```

## 注意事项

- 运行时为 Bun，最大化利用内置能力：
  - `Bun.spawn` 处理子进程（安装/更新/启动 agent）
  - `Bun.file` / `Bun.write` 处理文件读写
  - `fetch` 查询 npm registry 版本信息
- `packageManager` 字段锁定 Bun 版本
- 遵循 `@antfu/eslint-config` 代码规范
- `package.json` 需添加 `bin` 字段指向 CLI 入口
- Windows 平台需特别处理 PowerShell 安装脚本
