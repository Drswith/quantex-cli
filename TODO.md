# Silver CLI - AI Agent CLI 管理工具

## 项目简介

一个统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

## 技术栈

- **Runtime**: [Bun](https://bun.sh) — 包管理、脚本执行、运行时
- **Language**: TypeScript (strict mode)
- **Build**: [tsdown](https://github.com/nicepkg/tsdown) — 基于 rolldown 的打包工具
- **Test**: `bun test` — Bun 内置测试运行器
- **Lint**: @antfu/eslint-config
- **Run**: Bun 原生支持 TypeScript，无需 tsx

## 支持的 AI Agent

| Agent | 包名 | 说明 |
|-------|------|------|
| Claude Code | `@anthropic-ai/claude-code` | Anthropic 官方 CLI |
| Codex CLI | `@openai/codex` | OpenAI 官方 CLI |
| OpenCode | `opencode` | 开源 AI 编程 CLI |
| Gemini CLI | `@anthropic-ai/gemini-cli` | Google Gemini CLI |
| Aider | `aider-chat` | 开源 AI 结对编程工具 |
| Cursor | - | IDE 内置，通过二进制安装 |

## 配置系统

- 配置文件路径: `~/.silver/config.json`
- 使用 [c12](https://unjs.io/packages/c12) 实现配置加载，支持:
  - 默认配置（内置）
  - 用户配置（`~/.silver/config.json`）
  - 环境变量覆盖
  - 配置合并

### 配置文件结构（草案）

```json
{
  "defaultPackageManager": "bun",
  "agents": {
    "claude-code": {
      "packageManager": "bun",
      "package": "@anthropic-ai/claude-code",
      "autoUpdate": false
    },
    "codex": {
      "packageManager": "npm",
      "package": "@openai/codex"
    }
  }
}
```

## 安装方式

每个 Agent 支持以下安装方式（按优先级）:

### 1. bun（优先）
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

## CLI 命令设计

### 基础命令

```
silver                    # 显示帮助信息
silver --version          # 显示版本号
silver help <command>     # 显示命令帮助
```

### Agent 管理

```
silver install <agent>    # 安装指定 agent（别名: silver i）
silver update <agent>     # 更新指定 agent（别名: silver u）
silver update --all       # 更新所有已安装的 agent
silver uninstall <agent>  # 卸载指定 agent（别名: silver rm）
silver list               # 列出所有支持的 agent 及状态（别名: silver ls）
silver info <agent>       # 查看 agent 详细信息（版本、安装方式等）
```

### 配置管理

```
silver config             # 显示当前配置
silver config set <key> <value>   # 设置配置项
silver config get <key>           # 获取配置项
silver config reset               # 重置为默认配置
```

### 快捷启动 Agent

```
silver <agent> [args...]  # 直接启动 agent，透传所有参数
```

示例:
```bash
silver claude --dangerously-skip-permissions
silver codex --model o4-mini
silver opencode
```

默认 Agent 别名映射:

| 快捷名 | 实际命令 |
|--------|---------|
| `silver claude` | `claude`（即 claude-code） |
| `silver codex` | `codex`（即 openai codex） |
| `silver opencode` | `opencode` |
| `silver aider` | `aider` |

行为规则:
- 如果第一个参数匹配已注册的 agent 名称，则作为代理启动该 agent
- 后续所有参数原样透传给 agent 进程（`stdio: inherit`）
- agent 未安装时，提示是否自动安装后再启动
- 如果第一个参数不匹配任何 agent，则走正常的 CLI 命令路由

### 其他

```
silver doctor             # 检查环境（bun/npm/node 版本、已安装 agent 等）
silver which <agent>      # 查看 agent 可执行文件路径
```

## 技术架构

### 依赖库

| 库 | 用途 |
|----|------|
| [commander](https://github.com/tj/commander.js) | CLI 框架（最成熟，生态最大） |
| [c12](https://unjs.io/packages/c12) | 配置文件管理 |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | 终端彩色输出（极轻量） |
| [prompts](https://github.com/terkelg/prompts) | 交互式提示（安装确认等） |

> **利用 Bun 内置能力替代的依赖:**
> - `Bun.spawn` 替代 execa（子进程执行）
> - `Bun.file` / `Bun.write` 替代 fs-extra（文件操作）
> - `fetch`（Bun 内置）替代 ofetch（查询 npm registry 版本信息）
> - `bun test` 替代 vitest（测试运行器）
> - Bun 原生 TS 支持替代 tsx（直接运行 TypeScript）

### 目录结构（规划）

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
├── agents/               # Agent 定义与注册
│   ├── index.ts          # Agent 注册表
│   ├── types.ts          # Agent 类型定义
│   ├── claude-code.ts
│   ├── codex.ts
│   ├── opencode.ts
│   └── ...
├── package-manager/      # 包管理器抽象
│   ├── index.ts
│   ├── bun.ts
│   ├── npm.ts
│   └── binary.ts         # 二进制安装方式
├── config/               # 配置管理
│   ├── default.ts        # 默认配置
│   └── index.ts          # 配置加载（c12）
└── utils/                # 工具函数
    ├── detect.ts         # 环境检测（OS、包管理器可用性）
    ├── exec.ts           # 命令执行封装
    └── version.ts        # 版本查询与比较
```

### Agent 类型定义（草案）

```typescript
interface AgentDefinition {
  name: string              // 唯一标识，如 "claude-code"
  aliases: string[]         // 快捷启动名，如 ["claude"]
  displayName: string
  description: string
  package: string
  installMethods: InstallMethod[]
  binaryName: string        // 安装后的可执行文件名，如 "claude"
}

type InstallMethod = {
  type: 'bun' | 'npm' | 'binary'
  command: string | ((platform: Platform) => string)
  supportedPlatforms: Platform[]
  priority: number          // 越小越优先
}
```

## 开发计划

### Phase 1 - 基础框架
- [ ] 初始化 CLI 框架（commander）
- [ ] `package.json` 添加 `bin` 字段指向 CLI 入口
- [ ] 定义 Agent 类型与注册表
- [ ] 实现配置系统（c12）
- [ ] 实现环境检测（OS、bun/npm 可用性）
- [ ] 实现 `silver list` 命令

### Phase 2 - 核心功能
- [ ] 实现包管理器抽象层（bun/npm/binary）
- [ ] 实现 `silver install <agent>` 命令
- [ ] 实现 `silver update <agent>` 命令
- [ ] 实现 `silver uninstall <agent>` 命令
- [ ] 实现 `silver info <agent>` 命令
- [ ] 实现 `silver <agent> [args...]` 快捷启动（参数透传、未安装提示）

### Phase 3 - 体验优化
- [ ] 实现 `silver doctor` 环境检查
- [ ] 实现 `silver config` 配置管理
- [ ] 彩色输出与交互式提示
- [ ] 进度条与安装动画
- [ ] 错误处理与友好提示

### Phase 4 - 发布与完善
- [ ] 完善测试覆盖率
- [ ] CI/CD 自动发布（GitHub Actions）
- [ ] 编写 README 与使用文档
- [ ] npm 发布

## 注意事项

- 运行时为 Bun，最大化利用内置能力：
  - `Bun.spawn` 处理子进程（安装/更新/启动 agent）
  - `Bun.file` / `Bun.write` 处理文件读写
  - `fetch` 查询 npm registry 版本信息
  - `bun test` 运行测试
  - 直接运行 `.ts` 文件，无需 tsx 编译
- `packageManager` 字段锁定 Bun 版本
- 遵循 `@antfu/eslint-config` 代码规范
- `package.json` 需添加 `bin` 字段指向 CLI 入口
- Windows 平台需特别处理 PowerShell 安装脚本
