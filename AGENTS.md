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
    ├── detect.ts
    ├── exec.ts
    ├── install.ts
    ├── network.ts
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

## Notes

- Windows 平台需特别处理 PowerShell 安装脚本和 delayed binary replacement
- `quantex <agent>` 快捷启动时，未安装的 agent 应提示自动安装
- `quantex update --all` 优先使用已记录的实际安装来源，而不是只看 agent 定义中的候选安装方式
- `Bun.spawn` 使用 `stdio: 'inherit'` 透传 agent 进程 IO
- self binary upgrade 已包含 checksum、lock、verify、`.bak` rollback 与 Windows 延迟替换
