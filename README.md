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

- 通过 Bun 安装的 agent 会合并为一条 `bun update -g --latest ...`
- 通过 npm 安装的 agent 会合并为一条 `npm install -g ...@latest`
- 通过 Homebrew 安装的 agent 会按记录的 formula/cask 标识逐个更新
- 通过 winget 安装的 agent 会按 `winget` 记录的包 ID 逐个更新
- 通过脚本、直装二进制或仅在 PATH 中探测到的 agent 不会被自动更新

这意味着混合安装场景仍然安全，不会把通过其他方式安装的 agent 错误地塞进 Bun、npm、brew 或 winget 的更新命令；对非托管来源，Quantex 会明确提示需要手动更新。

### 升级 Quantex CLI

```bash
quantex upgrade
```

当前自身升级支持：

- 通过 Bun 全局安装的 `quantex-cli`
- 通过 npm 全局安装的 `quantex-cli`

如果当前是源码工作区运行或其他非托管来源，`upgrade` 会明确提示当前来源不支持自动升级。

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

`list` 会显示每个 agent 的安装状态、当前版本、是否支持托管更新，以及安装来源。例如：

- `managed update` 表示 Quantex 能按记录的安装器执行更新
- `manual update` 表示当前来源不支持自动更新
- `managed via bun (...)`、`managed via brew (...)` 表示有明确的来源记录
- `detected in PATH` 表示命令存在，但不是由当前 Quantex 状态文件追踪到的安装

### 查看 Agent 详情

```bash
quantex info claude
```

`info` 会按当前平台列出安装方式，并明确区分：

- `managed/<installer>`，例如 `managed/bun`、`managed/brew`
- `unmanaged/script`，例如 `curl | bash`、`irm | iex`
- `unmanaged/binary`，保留给未来真正的二进制直装场景

如果 agent 已安装，`info` 还会显示当前记录的 `Source` 和 `Lifecycle`。

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
quantex config set npmBunUpdateStrategy respect-semver

# 重置为默认配置
quantex config reset
```

### 环境检查

```bash
quantex doctor
```

`doctor` 会检查：

- `bun`、`npm`、`brew`、`winget` 这些托管安装器是否可用
- Quantex CLI 自身的当前版本、安装来源、是否支持自动升级
- 已安装 agent 的版本状态
- 已安装 agent 的生命周期和来源，例如 `managed; managed via bun (...)`
- 当前环境是否缺少任何可用于托管安装/更新的安装器

## 配置

配置文件位于 `~/.quantex/config.json`，支持以下配置项：

```json
{
  "defaultPackageManager": "bun",
  "npmBunUpdateStrategy": "latest-major"
}
```

`defaultPackageManager` 会影响托管安装方式的尝试顺序。比如某个 agent 同时支持 Bun 和 npm 时，设置为 `npm` 后，Quantex 会先尝试 npm，再按 agent 定义中的其余安装方式顺序回退。

这里的 `defaultPackageManager` 只影响托管安装器的选择顺序，不影响 `script` / `binary` 这类非托管安装方式。

`npmBunUpdateStrategy` 控制通过 npm / Bun 安装的 agent 在更新时的版本策略：

- `latest-major`：始终升级到 registry 上的最新版本，默认值
- `respect-semver`：遵循包管理器已有的 semver 更新语义

## 状态文件

除了配置文件外，Quantex 还会在 `~/.quantex/state.json` 中记录运行时状态，例如 agent 的实际安装来源。

当前安装来源会区分为：

- 托管安装器：`bun`、`npm`、`brew`、`winget`
- 非托管安装：`script`
- 预留类型：`binary`

这个状态文件主要用于：

- 让 `update --all` 先生成更新计划，再按 Bun、npm、brew、winget 分组执行
- 在混合安装场景下避免误用错误的更新方式
- 支撑 `list`、`info`、`doctor` 输出安装来源和是否可托管更新
- 为后续的卸载、诊断和迁移能力保留扩展空间

术语约定：

- `packages.npm` 指 agent 对应的 npm 包名
- 安装方法里的 `packageName` 指安装器专用标识；对 npm/bun 是包名，对 Homebrew 是 formula/cask 标识，对 winget 是 package ID

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
