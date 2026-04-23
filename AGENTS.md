# AGENTS.md

## Project

Quantex CLI — 统一的 AI Agent CLI 管理工具，支持安装、更新、卸载、查询、快捷启动主流 AI 编程助手。

项目定位补充：

- Quantex 是 `human-friendly + agent-friendly` 的 `agent lifecycle CLI`
- 主线聚焦 agent 的安装、检查、确保可用、更新、卸载、能力发现与稳定执行契约
- 不把主线推进成 workflow orchestration platform
- `batch / stdin pipe / apply / daemon / MCP server` 等能力默认视为扩展议题，不作为主线目标

## Tech Stack

- **Runtime**: Bun（运行时、包管理器）
- **Build**: tsdown（基于 rolldown）
- **Test**: Vitest
- **Language**: TypeScript (strict mode)
- **Lint**: @antfu/eslint-config
- **Dependencies**: commander, c12, picocolors, prompts

## Commands

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

Run `bun run lint` and `bun run typecheck` after making changes. If you touched behavior, run `bun run test` too.

## Code Style

- 遵循 `@antfu/eslint-config` 规范
- 不添加注释，除非用户要求
- 使用 ESM（`"type": "module"`）
- TypeScript strict mode + strictNullChecks

## Architecture

实现与设计原则：

- `core` 负责 agent registry、inspection、services、package-manager、state/self 等生命周期能力
- `surface` 负责 human CLI、JSON、NDJSON 等对外契约
- 命令最终产物是 typed result object，CLI 只是 renderer 之一
- 优先增强单次调用的可靠性、可发现性与非交互契约，不扩张为工作流编排平台

```text
src/
├── index.ts                # 导出核心 API
├── cli.ts                  # CLI 入口（commander）
├── postinstall.ts          # 发布包安装后的 self state best-effort 落盘
├── generated/
│   └── build-meta.ts       # 构建时注入的版本与仓库元数据
├── commands/
│   ├── install.ts
│   ├── update.ts
│   ├── upgrade.ts
│   ├── uninstall.ts
│   ├── list.ts
│   ├── info.ts
│   ├── inspect.ts
│   ├── ensure.ts
│   ├── resolve.ts
│   ├── exec.ts
│   ├── capabilities.ts
│   ├── commands.ts
│   ├── schema.ts
│   ├── run.ts
│   ├── config.ts
│   └── doctor.ts
├── agents/
│   ├── index.ts
│   ├── types.ts
│   ├── methods.ts
│   └── definitions/
├── agent-update/           # agent 更新策略层（managed/self-update/manual-hint）
│   ├── index.ts
│   ├── messages.ts
│   ├── providers.ts
│   └── types.ts
├── inspection/
│   ├── index.ts
│   └── agents.ts
├── package-manager/
│   ├── index.ts
│   ├── installers.ts
│   ├── capabilities.ts
│   ├── bun.ts
│   ├── npm.ts
│   ├── brew.ts
│   ├── winget.ts
│   └── binary.ts
├── planning/
│   ├── index.ts
│   └── updates.ts
├── services/
│   ├── index.ts
│   ├── agents.ts
│   └── update.ts
├── self/                   # Quantex CLI 自升级
│   ├── index.ts
│   ├── types.ts
│   ├── recovery.ts
│   ├── release.ts
│   ├── lock.ts
│   ├── binary.ts
│   ├── install-state.ts
│   └── providers/
├── release-artifacts/      # release manifest/checksum 生成与校验
│   └── index.ts
├── state/
│   └── index.ts
├── state.ts
├── config/
│   ├── default.ts
│   └── index.ts
└── utils/
    ├── color.ts
    ├── detect.ts
    ├── exec.ts
    ├── install.ts
    ├── lock.ts
    ├── lifecycle-errors.ts
    ├── network.ts
    ├── user-output.ts
    └── version.ts
```

## Key Types

```ts
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

interface AgentSelfUpdate {
  command: string[]
  fallbackCommands?: string[][]
  versionAfter?: 'same-process' | 'respawn'
}

interface AgentVersionProbe {
  command?: string[]
  parser?: (stdout: string) => string | undefined
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
  selfUpdate?: AgentSelfUpdate
  versionProbe?: AgentVersionProbe
}

type SelfInstallSource = 'bun' | 'npm' | 'binary' | 'source' | 'unknown'
type SelfUpdateChannel = 'stable' | 'beta'
type AgentUpdateStrategy = 'managed' | 'self-update' | 'manual-hint'
```

- `packages.npm` 表示 agent 对应的 npm 包名
- `InstallMethod.packageName` 表示安装器专用标识：npm/bun 用包名，brew 用 formula/cask 标识，winget 用 package ID
- `selfUpdate` 表示 agent 自带更新命令
- `versionProbe` 用于覆盖默认 `<binary> --version`

## CLI Commands

| Command | Description |
|---------|-------------|
| `quantex install <agent>` / `quantex i` | 安装 agent |
| `quantex update <agent>` / `quantex u` | 更新 agent |
| `quantex update --all` | 更新所有已安装的 agent，按安装来源和策略分组执行 |
| `quantex upgrade` | 升级 Quantex CLI 自身 |
| `quantex upgrade --check` | 只检查 Quantex CLI 是否有更新 |
| `quantex upgrade --channel beta` | 使用 beta channel 检查或升级 |
| `quantex uninstall <agent>` / `quantex rm` | 卸载 agent |
| `quantex list` / `quantex ls` | 列出所有 agent |
| `quantex info <agent>` | 查看 agent 详情 |
| `quantex inspect <agent>` | 查看 agent 结构化状态 |
| `quantex ensure <agent>` | 确保 agent 已安装 |
| `quantex resolve <agent>` | 解析 agent 可执行入口 |
| `quantex exec <agent> -- [args...]` | 以显式策略运行 agent |
| `quantex capabilities` | 查看当前环境与 surface 能力 |
| `quantex commands` | 查看稳定命令目录 |
| `quantex schema` | 查看结构化输出 schema |
| `quantex <agent> [args...]` | 快捷启动 agent |
| `quantex config` | 配置管理 |
| `quantex doctor` | 环境检查 |

## Config

- Path: `~/.quantex/config.json`
- Loaded via c12 with defaults → user config → env override merging
- `defaultPackageManager`: 控制托管安装器的优先尝试顺序
- `npmBunUpdateStrategy`: 控制 npm / Bun 更新时是直接升到最新版本，还是遵循 semver 约束
- `selfUpdateChannel`: 控制 Quantex CLI 自升级默认 channel
- `networkRetries`: 网络请求重试次数
- `networkTimeoutMs`: 网络请求超时时间
- `versionCacheTtlHours`: registry / release manifest / GitHub release 查询缓存 TTL

## State

- Path: `~/.quantex/state.json`
- Stores runtime state for:
  - each agent's actual install source
  - Quantex CLI 自身的 `self.installSource`
- Used by:
  - `quantex update --all` 的分组批量更新
  - self upgrade 的来源判断
  - `list` / `info` / `doctor` 的来源与恢复提示

## Ordering Semantics

- Agent 安装方式按定义数组顺序表达回退顺序
- `defaultPackageManager` 只会把匹配的托管安装器前置，不再依赖单独的 `priority` 字段
- `npmBunUpdateStrategy` 默认是 `latest-major`
- agent 更新策略优先级是：
  - `managed`
  - `self-update`
  - `manual-hint`
- self upgrade provider 按安装来源分派：
  - `bun`
  - `npm`
  - `binary`
  - `source`

## Release Artifacts

- `scripts/write-release-checksums.ts` 生成 `dist/bin/SHA256SUMS.txt`
- `scripts/generate-release-manifest.ts` 生成 `dist/bin/manifest.json`
- `scripts/verify-release-artifacts.ts` 校验 manifest 与 checksum 一致性
- `bun run release:artifacts` 会串联以上三步

## Project Memory System

- Canonical project memory now lives in:
  - `docs/`
  - `autonomy/`
  - `openspec/`
- Before creating a new markdown file, classify it first:
  - behavior contract or change proposal → `openspec/`
  - durable design decision → `docs/adr/`
  - troubleshooting or recovery knowledge → `docs/runbooks/`
  - session summary → `docs/sessions/`
  - incident review → `docs/postmortems/`
  - future executable work → `autonomy/tasks/` + `autonomy/queue.md`
- Treat discussion notes as an intermediate artifact. Promote stable outcomes into specs, ADRs, runbooks, or task contracts.
- Legacy root markdown files are transition artifacts. Their target homes are tracked in `docs/project-memory-migration.md`.
- When implementation changes behavior or durable process, update the relevant spec, ADR, runbook, or task in the same change whenever practical.

## Notes

- Windows 平台需特别处理 PowerShell 安装脚本和 delayed binary replacement
- `quantex <agent>` 快捷启动时，未安装的 agent 应提示自动安装
- `quantex update --all` 优先使用已记录的实际安装来源，而不是只看 agent 定义中的候选安装方式
- `Bun.spawn` 使用 `stdio: 'inherit'` 透传 agent 进程 IO
- self binary upgrade 已包含 checksum、lock、verify、`.bak` rollback 与 Windows 延迟替换
- 全局 dual-mode surface 当前还包括 `--yes`、`--quiet`、`--color`、`--log-level`、`--dry-run`、`--refresh`、`--no-cache`
- 结构化 `meta` 当前可附带 `fetchedAt`、`staleAfter`、`source`
