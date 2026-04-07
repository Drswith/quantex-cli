# AGENTS.md

## Project

Silver CLI — 统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

## Tech Stack

- **Runtime**: Bun（运行时、包管理器、测试）
- **Build**: tsdown（基于 rolldown）
- **Language**: TypeScript (strict mode)
- **Lint**: @antfu/eslint-config
- **Dependencies**: commander, c12, picocolors, prompts

## Commands

```bash
bun install              # 安装依赖
bun run dev              # 开发运行（bun run src/cli.ts）
bun test                 # 运行测试
bun run lint             # ESLint 检查
bun run typecheck        # TypeScript 类型检查
bun run build            # 打包（tsdown）
```

Run `bun run lint` and `bun run typecheck` after making changes.

## Bun Built-in APIs

Prefer Bun built-in capabilities over external dependencies:

- `Bun.spawn` — 子进程执行（替代 execa）
- `Bun.file` / `Bun.write` — 文件操作（替代 fs-extra）
- `fetch` — HTTP 请求（替代 ofetch/axios）
- `bun test` — 测试运行器（替代 vitest/jest）

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
│   ├── claude-code.ts
│   ├── codex.ts
│   └── opencode.ts
├── package-manager/      # 包管理器抽象
│   ├── index.ts
│   ├── bun.ts
│   ├── npm.ts
│   └── binary.ts
├── config/               # 配置管理
│   ├── default.ts
│   └── index.ts          # c12 加载
└── utils/
    ├── detect.ts         # 环境检测
    ├── exec.ts           # 命令执行封装
    └── version.ts        # 版本查询
```

## Key Types

```typescript
interface AgentDefinition {
  name: string
  aliases: string[]
  displayName: string
  description: string
  package: string
  installMethods: InstallMethod[]
  binaryName: string
}

type InstallMethod = {
  type: 'bun' | 'npm' | 'binary'
  command: string | ((platform: Platform) => string)
  supportedPlatforms: Platform[]
  priority: number
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `silver install <agent>` / `silver i` | 安装 agent |
| `silver update <agent>` / `silver u` | 更新 agent |
| `silver uninstall <agent>` / `silver rm` | 卸载 agent |
| `silver list` / `silver ls` | 列出所有 agent |
| `silver info <agent>` | 查看 agent 详情 |
| `silver <agent> [args...]` | 快捷启动 agent（参数透传） |
| `silver config` | 配置管理 |
| `silver doctor` | 环境检查 |

## Config

- Path: `~/.silver/config.json`
- Loaded via c12 with defaults → user config → env override merging

## Notes

- Windows 平台需特别处理 PowerShell 安装脚本
- `silver <agent>` 快捷启动时，未安装的 agent 应提示自动安装
- `Bun.spawn` 使用 `stdio: 'inherit'` 透传 agent 进程 IO
