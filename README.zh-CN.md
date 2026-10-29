# Quantex CLI

<div align="center">

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Release][release-src]][release-href]
[![CI][ci-src]][ci-href]
[![Platforms][platforms-src]][release-href]
[![License][license-src]][license-href]

用一个对 agent 友好的命令行，安装、检查、更新、卸载和启动各类 AI 编码助手 CLI。

[English](./README.md) | **简体中文**

</div>

Quantex 是面向 AI 编码助手和终端编码 agent 的生命周期 CLI，人和 agent 都能直接用。一个 `qtx` 命令就能安装、检查、更新、卸载和启动 Codex CLI、Claude Code、Cursor CLI、OpenCode、Pi 等 22 个 agent，并提供稳定的机器可读输出。`qtx` 和 `quantex` 是同一个命令，本文用较短的 `qtx`。

## 为什么用 Quantex

- 多个 agent CLI 共用一套生命周期命令：`install`、`info`、`resolve`、`update`、`uninstall`、`exec`。
- 为脚本和 agent 设计：`--json`、`--non-interactive`、`--dry-run`、`--timeout`，错误码和退出码都有文档。
- 记录每个 agent 真实的安装来源（npm、Bun 或官方安装脚本），`update --all` 按记录的来源更新，而不是凭 `PATH` 猜。
- 先验证再记录：每次安装、更新、卸载之后都会重新观测一次再写入状态。
- 单个原生二进制（约 3 MB），不需要安装运行时，用 `quantex upgrade` 保持最新。

## 安装

macOS 与 Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/Drswith/quantex-cli/main/install.ps1 | iex
```

脚本会先用 `SHA256SUMS.txt` 校验下载内容，再把 `quantex` 和 `qtx` 装到 `~/.local/bin`（用 `QUANTEX_INSTALL_DIR` 改目录，用 `QUANTEX_VERSION=v<版本>` 固定版本）。

也可以用 npm 或 Bun 安装，它们会通过对应平台的子包装上同一个原生二进制：

```bash
npm install -g quantex-cli
```

```bash
bun add -g quantex-cli
```

每个 [GitHub release](https://github.com/Drswith/quantex-cli/releases) 都附带 macOS（arm64、x64）、Linux（arm64、x64，静态链接）和 Windows（x64）的二进制。

预发布版本以 GitHub 预发布的形式发布（开启 npm 发布后，也会发到 npm 的 `beta` 标签：`npm install -g quantex-cli@beta`）；stable 通道的安装永远不会被推送预发布版本。

## 快速上手

安装并启动 agent：

```bash
qtx install claude codex
qtx exec claude --install if-missing -- --help
```

agent 已经安装时，再次安装会直接成功、不做改动，所以脚本可以每次都运行 `install`（或它的别名 `ensure`）：

```bash
qtx install codex --json
```

查看 agent 状态、解析可执行文件：

```bash
qtx info codex --json
qtx resolve codex --json
```

更新单个 agent，或更新 Quantex 管理的全部 agent：

```bash
qtx update claude
qtx update --all
```

升级 Quantex 自身：

```bash
qtx upgrade --check
qtx upgrade
```

## 命令

| 命令 | 说明 |
|---|---|
| `qtx install <agent> [更多...]`（`i`、`ensure`） | 安装缺失的 agent |
| `qtx update <agent>`（`u`）、`qtx update --all [--managed]` | 更新某个 agent，或全部已安装的 agent |
| `qtx uninstall <agent>`（`rm`） | 卸载由 Quantex 安装的 agent |
| `qtx list`（`ls`） | 列出支持的 agent 及安装情况 |
| `qtx info <agent>`（`inspect`） | 查看 agent 详情、状态和安装方式 |
| `qtx resolve <agent>` | 解析要启动的可执行文件 |
| `qtx exec <agent> [--install never\|if-missing\|always] -- [参数...]` | 按明确的安装策略启动 agent |
| `qtx <agent> [参数...]` | 启动 agent，缺失时询问是否安装 |
| `qtx doctor` | 诊断环境并给出恢复步骤 |
| `qtx commands` | 查看稳定的命令目录 |
| `qtx config [list\|get\|set\|reset] [key] [value]` | 查看和修改配置 |
| `qtx upgrade [--check] [--channel stable\|beta]` | 升级 Quantex 自身 |

`qtx uninstall` 只处理 Quantex 记录的安装来源，不会删除 `PATH` 上另外安装的副本；用 `qtx info <agent> --json` 可以看清各个副本的来源。

## 支持的 agent

| Agent | 启动命令 | 说明 |
|---|---|---|
| Amp | `qtx amp` | Sourcegraph 的前沿 AI 编码 agent CLI |
| Antigravity CLI | `qtx antigravity` | Google 的 Antigravity 终端编码 agent CLI |
| Claude Code | `qtx claude` | Anthropic 官方 AI 编码助手 CLI |
| CodeBuddy Code | `qtx codebuddy` | 腾讯官方 AI 编码助手 CLI |
| Codex CLI | `qtx codex` | OpenAI 官方 AI 编码助手 CLI |
| Command Code | `qtx commandcode` | Command Code 的 AI 编码助手 CLI |
| Crush | `qtx crush` | Charmbracelet 的终端 AI 编码 agent CLI |
| Cursor CLI | `qtx cursor` | Cursor AI 编码助手 CLI |
| DeepSeek Harness | `qtx dsh` | DeepSeek 官方插件化 agent harness CLI |
| Devin for Terminal | `qtx devin` | Cognition 的本地编码 agent CLI |
| Droid | `qtx droid` | Factory AI 软件工程 agent CLI |
| GitHub Copilot CLI | `qtx copilot` | GitHub Copilot 命令行工具 |
| Grok Build | `qtx grok` | xAI 的终端编码 agent CLI |
| Hermes Agent | `qtx hermes` | Nous Research 的自我改进 AI agent CLI |
| Kilo CLI | `qtx kilo` | Kilo 官方 AI 编码助手 CLI |
| Kimi Code | `qtx kimi` | 月之暗面的编码助手 CLI |
| MiMoCode | `qtx mimo` | 小米的终端原生 AI 编码助手 CLI |
| oh-my-pi (OMP) | `qtx omp` | oh-my-pi 编码 agent CLI |
| OpenClaw | `qtx openclaw` | OpenClaw 开源 AI agent 运行时 CLI |
| OpenCode | `qtx opencode` | 开源 AI 编码 CLI |
| Pi | `qtx pi` | 精简、可扩展的终端编码 agent |
| Qoder CLI | `qtx qoder` | Qoder 官方 AI 编码助手 CLI |

## 给 agent 和自动化使用

Quantex 是生命周期工具，不是工作流编排平台。使用它的 agent 应先安装 Quantex skill，里面有命令用法和输出契约：

```bash
npx skills add Drswith/quantex-cli --skill quantex-cli -a codex -a claude-code -a opencode -y
```

然后发现稳定的命令面：

```bash
qtx commands --json
```

agent 可以依赖的契约：

- `--json` 输出一个结果信封 `{ action, ok, data, error, warnings, meta, target }`。
- 使用 `--json` 时 stdout 只输出信封；日志、警告、提示以及安装器和 agent 的输出都走 stderr。
- `--non-interactive` 从不提示（需要确认时返回 `INTERACTION_REQUIRED`）；`--yes` 自动确认；`--quiet` 关闭提示性输出。
- `--dry-run` 报告 `install`、`update`、`uninstall`、`exec`、`upgrade` 将会做什么，但不执行。
- `--timeout <时长>`（`500ms`、`30s`、`2m`）限制命令时长；`--refresh` 与 `--no-cache` 控制版本缓存；`--run-id` 设置 `meta.runId`。
- `install`、`update`、`uninstall` 都可以重试：已经没有事要做时直接成功，不做改动。

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | `INSTALL_FAILED`、`UPDATE_FAILED`、`UNINSTALL_FAILED`、`UNINSTALL_UNMANAGED`、`UPGRADE_FAILED`（以及有可用更新时的 `upgrade --check`） |
| 2 | `INVALID_ARGUMENT`，包括未知选项和缺少参数 |
| 3 | `AGENT_NOT_FOUND` |
| 4 | `AGENT_NOT_INSTALLED` |
| 6 | `NETWORK_ERROR` |
| 7 | `INTERACTION_REQUIRED` |
| 8 | `MANUAL_ACTION_REQUIRED` |
| 9 | `RESOURCE_LOCKED` |
| 10 | `TIMEOUT` |
| 11 | `CANCELLED` |
| 12 | `STATE_READ_ERROR` |

agent 启动之后，`qtx exec` 和 `qtx <agent>` 以 agent 自己的退出码退出。

## 配置与状态

配置在 `~/.quantex/config.json`，用 `qtx config` 管理：

```json
{
  "defaultPackageManager": "bun",
  "networkTimeoutMs": 10000,
  "selfUpdateChannel": "stable"
}
```

- `defaultPackageManager`（`bun` 或 `npm`）：agent 提供该安装器时把它排在最前。
- `networkTimeoutMs`：每次版本查询的超时；`selfUpdateChannel`：`stable` 或 `beta`。
- npm 和 Bun 安装的 agent 总是更新到最新版本。
- `selfUpdateRegistry`（默认不设置）：npm 和 Bun 安装执行 `qtx upgrade` 时使用的 registry；`QTX_SELF_UPDATE_REGISTRY` 可以单次覆盖，不影响其他项目。

Quantex 在 `~/.quantex/state.json` 中记录每个 agent 的安装来源和验证后的收据；版本查询缓存在 `~/.quantex/cache/`，锁在 `~/.quantex/locks/`。

## 从 1.x 升级

Quantex 2 用 Rust 重写，保留 1.x 的核心命令行、JSON 字段、错误码和 `~/.quantex` 下的文件，去掉了很少有人用的部分。1.x 安装可以直接 `qtx upgrade` 升级，1.x 与 2.x 可以共用同一个 home 目录。Windows 上的 1.x 独立二进制从来无法完成自升级（会报告 `updated`，但文件没有被替换），请改为重新运行 `install.ps1`。变化如下：

- 删除：11 个很少使用的 agent；Homebrew、winget、Cargo、Deno、mise、pip、uv 这些安装途径；NDJSON 输出和 `--output`（改用 `--json`）；`--log-level`；`--idempotency-key`；`capabilities` 和 `schema` 命令；配置项 `npmBunUpdateStrategy`、`networkRetries`、`versionCacheTtlHours`。`ensure` 和 `inspect` 保留为 `install` 和 `info` 的别名。完整列表见 [`CHANGELOG.md`](./CHANGELOG.md)。
- 参数错误（未知选项、缺少参数、取值无效）退出码为 2，使用 `--json` 时输出 `INVALID_ARGUMENT` 信封；1.x 打印纯文本错误并以 1 退出。
- human 输出不属于契约，排版与 1.x 不同，含义一致。
- npm 包不再导出 JavaScript 库，这条线也不再发布 `quantex-core`。
- 修复了若干 1.x 缺陷，逐条列在 [`contract/README.md`](./contract/README.md)。

## 参与开发

先读 [AGENTS.md](./AGENTS.md)。接口定义在 [`contract/`](./contract/README.md)，由 [`tests/contract/`](./tests/contract) 中的黑盒测试检查。设计记录在 [`docs/design/`](./docs/design/)，发布流程见 [`docs/runbooks/releasing.md`](./docs/runbooks/releasing.md)。

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## 许可证

Apache-2.0

[npm-version-src]: https://img.shields.io/npm/v/quantex-cli?style=flat-square
[npm-version-href]: https://www.npmjs.com/package/quantex-cli
[npm-downloads-src]: https://img.shields.io/npm/dm/quantex-cli?style=flat-square
[npm-downloads-href]: https://www.npmjs.com/package/quantex-cli
[ci-src]: https://img.shields.io/github/actions/workflow/status/Drswith/quantex-cli/ci.yml?branch=main&style=flat-square&label=ci
[ci-href]: https://github.com/Drswith/quantex-cli/actions/workflows/ci.yml
[release-src]: https://img.shields.io/github/v/release/Drswith/quantex-cli?display_name=tag&sort=semver&style=flat-square
[release-href]: https://github.com/Drswith/quantex-cli/releases
[platforms-src]: https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-555?style=flat-square
[license-src]: https://img.shields.io/npm/l/quantex-cli?style=flat-square
[license-href]: ./LICENSE
