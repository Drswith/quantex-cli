# AGENTS.md

## Project

Quantex CLI — 统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

## Tech Stack

- **Runtime**: Bun（运行时、包管理器）
- **Build**: tsdown（基于 rolldown）
- **Test**: Vitest
- **Language**: TypeScript (strict mode)
- **Lint**: @antfu/eslint-config
- **Dependencies**: commander, c12, picocolors, prompts

## Commands

```bash
bun install              # 安装依赖
bun run dev              # 开发运行
bun run test             # 运行测试
bun run test:watch       # 监听模式运行测试
bun run lint             # ESLint 检查
bun run typecheck        # TypeScript 类型检查
bun run build            # 打包（tsdown）
```

Run `bun run lint` and `bun run typecheck` after making changes.

## Code Style

- 遵循 @antfu/eslint-config 规范
- 不添加注释，除非用户要求
- 使用 ESM（`"type": "module"`）
- TypeScript strict mode + strictNullChecks

## Architecture

```
src/
├── index.ts              # 导出核心 API
├── cli.ts                # CLI 入口（commander）
├── commands/             # CLI 命令
│   ├── install.ts
│   ├── update.ts
│   ├── uninstall.ts
│   ├── list.ts
│   ├── info.ts
│   ├── run.ts            # 快捷启动 agent
│   ├── config.ts
│   └── doctor.ts
├── agents/               # Agent 定义与注册
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
├── inspection/           # Agent 运行期探测与聚合
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
│   ├── default.ts
│   └── index.ts          # c12 加载
└── utils/
    ├── detect.ts         # 环境检测
    ├── exec.ts           # 命令执行封装
    ├── install.ts        # 安装来源/展示辅助
    └── version.ts        # 版本查询
```

## Key Types

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
  name: string
  lookupAliases?: string[]
  displayName: string
  description: string
  homepage: string
  packages?: {
    npm?: string
  }
  platforms: Partial<Record<Platform, InstallMethod[]>>
  binaryName: string
}
```

- `packages.npm` 表示 agent 对应的 npm 包名
- `InstallMethod.packageName` 表示安装器专用标识：npm/bun 用包名，brew 用 formula/cask 标识，winget 用 package ID

## CLI Commands

| Command | Description |
|---------|-------------|
| `quantex install <agent>` / `quantex i` | 安装 agent |
| `quantex update <agent>` / `quantex u` | 更新 agent |
| `quantex update --all` | 更新所有已安装的 agent，按安装来源分组批量更新 |
| `quantex upgrade` | 升级 Quantex CLI 自身 |
| `quantex uninstall <agent>` / `quantex rm` | 卸载 agent |
| `quantex list` / `quantex ls` | 列出所有 agent |
| `quantex info <agent>` | 查看 agent 详情 |
| `quantex <agent> [args...]` | 快捷启动 agent（参数透传） |
| `quantex config` | 配置管理 |
| `quantex doctor` | 环境检查 |

## Config

- Path: `~/.quantex/config.json`
- Loaded via c12 with defaults → user config → env override merging

## State

- Path: `~/.quantex/state.json`
- Stores runtime state such as each agent's actual install source
- Used by `quantex update --all` to batch Bun/npm updates while keeping binary/script installs on the fallback path

## Ordering Semantics

- Agent 安装方式按定义数组顺序表达回退顺序
- `defaultPackageManager` 只会把匹配的托管安装器前置，不再依赖单独的 `priority` 字段

## Notes

- Windows 平台需特别处理 PowerShell 安装脚本
- `quantex <agent>` 快捷启动时，未安装的 agent 应提示自动安装
- `quantex update --all` 不应仅依赖 agent 定义中的候选安装方式，而应优先使用已记录的实际安装来源
- `Bun.spawn` 使用 `stdio: 'inherit'` 透传 agent 进程 IO
