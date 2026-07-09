## Context

官方文档（https://docs.x.ai/build/overview）将产品称为 Grok Build，安装与启动命令为：

- macOS/Linux: `curl -fsSL https://x.ai/cli/install.sh | bash`
- Windows: `irm https://x.ai/cli/install.ps1 | iex`
- 交互启动: `grok`
- 无头: `grok -p "..."`

安装脚本将二进制安装到 `~/.grok/bin`，并同时链接/复制 `grok` 与 `agent`。Changelog 明确存在 `grok update` 自更新路径，以及 `grok --version` 版本探测。官方 overview 未文档化 npm/Homebrew/Bun 等包管理安装方式。

Quantex 中 `agent` 已是 Cursor CLI 的 lookup alias（`cursor.binaryName = "agent"`）。因此不能把 Grok 的 `agent` 可执行别名登记为 Quantex lookup alias。

## Goals / Non-Goals

**Goals:**

- 将 Grok Build 加入 lifecycle catalog，支持 install / inspect / ensure / update / exec。
- 使用上游文档化的官方脚本安装方法与 `grok update` self-update。
- 保持与 Cursor 的 `agent` alias 无冲突。
- 同步产品文档中的 supported-agent 列表。

**Non-Goals:**

- 将 Grok Build 建模为 workflow orchestration、ACP host 或 Quantex 内部编排能力。
- 添加上游未文档化的 npm/brew/bun/mise 安装方法。
- 将 `agent` 登记为 Grok 的 lookup alias。
- 改变现有 package-manager 或 update planner 行为。

## Decisions

### 1. Canonical slug 与 binary 均为 `grok`

上游可执行命令稳定且产品专属，符合 agent-support-matrix 的默认命名规则。`displayName` 使用产品名 `Grok Build`。

### 2. Alias 仅使用 `grok-build`

产品名变体便于发现。不登记 `agent`，避免覆盖 Cursor CLI 的现有 lookup。

### 3. 仅暴露官方 script installers

三端均有官方脚本：Windows PowerShell 与 Unix curl。不添加 managed package metadata，因为 overview 未提供官方包名。

### 4. Self-update 使用 `grok update`

Changelog 与安装后行为均以 `grok update` 为官方升级路径，适合写入 `selfUpdate.command`。

### 5. Version probe 使用 `grok --version`

安装脚本在安装后用 `--version` 做冒烟校验；catalog 与之对齐。

### 6. Homepage 指向官方 Build overview

`https://docs.x.ai/build/overview` 是用户与 agent 获取安装/用法契约的权威入口。

## Risks / Trade-offs

- [安装脚本同时提供 `agent` 二进制，用户可能用 `quantex agent` 期望启动 Grok] -> Quantex 继续将 `agent` 解析为 Cursor；文档与 alias 明确使用 `grok` / `grok-build`。
- [未来若官方发布 npm/brew 包] -> 可在后续 catalog 变更中追加 managed methods，不阻塞本次最小闭环。
- [Grok Build 仍为 beta] -> lifecycle 元数据仅依赖已公开的 install/update/version 契约，不依赖不稳定的产品内部能力。
