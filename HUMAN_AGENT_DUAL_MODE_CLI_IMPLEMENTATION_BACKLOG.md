# Human + Agent 双模 CLI Implementation Checklist / Issue Backlog

> 本文档基于以下讨论文档整理：
>
> - [HUMAN_AGENT_DUAL_MODE_CLI.md](./HUMAN_AGENT_DUAL_MODE_CLI.md)
> - [HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md](./HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md)
>
> 不修改补遗文件内容；这里只做实现拆分、当前状态盘点与 issue backlog 组织。

## 1. 用途

本文档同时服务两类场景：

- implementation checklist：判断主线目前做到哪里、还缺什么
- issue backlog：把剩余主线工作拆成可执行 issue

状态约定：

- `[x]` 已完成
- `[~]` 部分完成，仍需补齐
- `[ ]` 未开始

优先级约定：

- `P0` 主线阻塞项
- `P1` 高价值主线项
- `P2` 主线增强项
- `P3` 扩展议题

## 2. 定位决策

Quantex 主线明确收敛为：

- `human-friendly + agent-friendly` 的 `agent lifecycle CLI`
- 聚焦 agent 的安装、检查、确保可用、更新、卸载、能力发现与稳定执行契约
- 默认保留 human-first CLI 体验，同时为 agent 提供非交互、可解析、可重试的 surface

以下能力不纳入当前主线：

- workflow orchestration
- plan -> apply pipeline
- batch target 协议
- stdin / pipe 驱动的执行编排
- daemon / HTTP / MCP server surface

这些能力可以保留为 extension parking lot，但不应继续推动 Quantex 偏离轻量化 lifecycle CLI 的定位。

## 3. 已确认的不变量

- [x] 默认保留 human-first CLI，而不是改成 agent-only 工具
- [x] human CLI、JSON、NDJSON 共用同一份 core 与结果模型
- [x] 命令最终产物是 typed result object，CLI 只是 renderer 之一
- [x] `quantex <agent>` 继续主要服务人类快捷使用
- [x] `quantex exec <agent> -- [args...]` 作为 agent-safe 标准执行入口
- [x] agent mode 必须非交互、可稳定解析、可感知错误类别
- [x] 结果协议需要显式版本化，不能只依赖 CLI version
- [x] 主线优先解决“单次调用可靠性”，不扩展成 workflow platform

## 4. 当前状态

截至当前仓库状态，主线已完成或部分完成的能力如下：

- [x] 已有统一 dual-mode 基础：`human` / `json` / `ndjson`
- [x] 已有统一 result envelope、`schemaVersion`、`runId`、`timestamp`
- [x] 已有稳定错误码与退出码映射
- [x] 已支持全局 `--json`
- [x] 已支持全局 `--output <human|json|ndjson>`
- [x] 已支持全局 `--non-interactive`
- [x] 已支持全局 `--run-id`
- [x] 已支持全局 `--timeout`
- [x] 已支持全局 `--idempotency-key`
- [x] 已支持 `QUANTEX_RUN_ID`
- [x] 已实现 `inspect`
- [x] 已实现 `ensure`
- [x] 已实现 `exec`
- [x] 已实现 `capabilities`
- [x] 已实现 `commands`
- [x] 已实现 `schema`
- [x] 已支持 timeout 错误与 signal cancel
- [x] 已支持 idempotency replay
- [~] `stdout` / `stderr` 契约已有基础，但还没有完全硬化
- [~] 测试已覆盖 schema / timeout / cancel / idempotency，但契约测试体系仍未完整
- [ ] 尚未实现 `resolve`
- [ ] 尚未实现缓存新鲜度字段：`fetchedAt` / `staleAfter` / `source`
- [ ] 尚未实现 `--yes` / `--quiet` / `--color` / `--log-level` / `--dry-run`
- [ ] 尚未实现 `--refresh` / `--no-cache`
- [ ] 尚未实现 stdout/stderr 的严格 installer log policy
- [ ] 尚未实现 state / install / uninstall 的资源锁
- [ ] 尚未实现 timeout / signal 对 inherited child process 的统一终止语义

## 5. Mainline Checklist

### 5.1 定位与文档

- [x] README 明确 lifecycle CLI 定位
- [x] 设计文档明确主线边界
- [x] implementation backlog 拆成 mainline 与 extension
- [x] AGENTS.md 补充 scope guidance

### 5.2 Surface 契约

- [x] 统一 result envelope
- [x] `meta.schemaVersion`
- [x] `meta.runId` / `timestamp`
- [x] human / json / ndjson renderer
- [x] 命令先产出 result object，再统一渲染
- [x] schema 导出稳定命令输出定义
- [~] `stdout` / `stderr` 契约
- [ ] `stderr` 结构化日志与 installer log policy
- [ ] `meta.fetchedAt` / `staleAfter` / `source`

### 5.3 全局策略

- [x] `--json`
- [x] `--output <human|json|ndjson>`
- [x] `--non-interactive`
- [x] `--run-id`
- [x] `--timeout`
- [x] `--idempotency-key`
- [ ] `--yes`
- [ ] `--quiet`
- [ ] `--color <auto|always|never>`
- [ ] `--log-level <silent|error|warn|info|debug>`
- [ ] `--dry-run`
- [ ] `--refresh` / `--no-cache`
- [ ] stdout / stdin 非 TTY 时自动切到 agent-friendly 行为

### 5.4 Lifecycle Commands

- [x] `quantex inspect <agent>`
- [x] `quantex ensure <agent>`
- [ ] `quantex resolve <agent>`
- [x] `quantex exec <agent> -- [args...]`
- [x] `quantex capabilities`
- [x] `quantex commands`
- [x] `quantex schema`

### 5.5 Reliability

- [x] `run-id`
- [x] `timeout`
- [x] `idempotency-key`
- [x] SIGTERM / SIGINT cancel
- [ ] state / install / uninstall 资源锁
- [ ] inherited child process 的 timeout / signal 终止语义
- [ ] 缓存新鲜度与 refresh policy

### 5.6 Tests

- [x] schema command tests
- [x] timeout tests
- [x] cancel tests
- [x] idempotency tests
- [x] non-interactive 行为测试
- [ ] human vs json snapshot tests
- [ ] `stdout` / `stderr` contract tests
- [ ] 完整 exit code / error code matrix tests
- [ ] schema contract drift tests

## 6. MVP 状态

### MVP-1 | 最小可用 agent mode

- [x] 全局 `--json`
- [x] 全局 `--non-interactive`
- [x] 统一 result envelope
- [x] 统一 error code / exit code
- [x] `list / info / install / update / doctor / upgrade` 的 JSON 输出
- [x] `quantex <agent>` 在 non-interactive 下禁止 prompt

### MVP-2 | 高价值主线补强

- [x] `inspect`
- [x] `ensure`
- [x] `exec`
- [x] `capabilities`
- [x] `schema`
- [x] `commands`
- [x] `--run-id`
- [x] `--timeout`
- [x] `--idempotency-key`
- [x] `update --all --output ndjson`
- [ ] `resolve`

## 7. Mainline Issue Backlog

### LIFECYCLE-01 | `resolve`

- Priority: `P1`
- Status: `[ ]`
- Goal: 提供可执行 binary 的结构化解析结果
- Scope:
  - 新增 `quantex resolve <agent>`
  - 输出 `binaryName`、`binaryPath`、`installedVersion`、`installSource`、`suggestedLaunchCommand`
- Acceptance:
  - 上游 runtime 无需再自行探测 PATH
  - resolve 失败时有稳定错误码

### CONTRACT-01 | stdout / stderr 契约硬化

- Priority: `P1`
- Status: `[~]`
- Goal: 让 agent mode 下的输出边界完全稳定
- Scope:
  - 明确 installer log 走向
  - 补 `stderr` 结构化日志策略
  - 补 contract tests
- Acceptance:
  - `--json` 时 `stdout` 只输出最终 envelope
  - `--output ndjson` 时 `stdout` 只输出事件流
  - installer 日志不会污染结构化结果

### RELIABILITY-01 | inherited child process 终止语义

- Priority: `P1`
- Status: `[ ]`
- Goal: 让 timeout / cancel 不只是返回错误，还能可靠作用于底层长任务
- Scope:
  - 明确 `exec` / `run` / `upgrade` 的 child process termination policy
  - signal / timeout 时向子进程传递终止信号
- Acceptance:
  - 长任务不会在 CLI 已返回取消后继续悬挂
  - timeout / cancel 行为在主要命令上可测试

### STATE-01 | state / install / uninstall 资源锁

- Priority: `P1`
- Status: `[ ]`
- Goal: 避免多个终端或多个 agent 同时调用时互相踩状态
- Scope:
  - `state.json` 写入锁
  - install / uninstall / self-upgrade 互斥保护
- Acceptance:
  - 并发修改返回稳定冲突错误
  - state 文件不会被交错写坏

### FRESHNESS-01 | 缓存新鲜度与 refresh policy

- Priority: `P2`
- Status: `[ ]`
- Goal: 让 agent 知道版本数据是否来自缓存、何时过期
- Scope:
  - `meta.fetchedAt`
  - `meta.staleAfter`
  - `meta.source = cache | network`
  - `--refresh` / `--no-cache`
- Acceptance:
  - 版本查询结果的新鲜度可判断
  - agent 可自主决定是否强刷

### UX-01 | 可选全局参数补齐

- Priority: `P2`
- Status: `[ ]`
- Goal: 补足对人类用户友好、但不影响主线定位的辅助参数
- Scope:
  - `--yes`
  - `--quiet`
  - `--color`
  - `--log-level`
  - `--dry-run`
- Acceptance:
  - 不破坏现有默认 human-first 体验
  - 与 agent mode 契约不冲突

### TEST-01 | 契约测试收口

- Priority: `P1`
- Status: `[~]`
- Goal: 用测试保障 lifecycle CLI 主线长期稳定
- Scope:
  - human vs json snapshot
  - stdout / stderr contract
  - error code / exit code matrix
  - schema drift test
- Acceptance:
  - 结构化输出变化需要显式更新
  - 契约回归能被测试及时拦下

## 8. Extension Parking Lot

以下能力保留为扩展议题，不进入当前主线：

### EXT-01 | `plan update --all`

- Priority: `P3`
- Why deferred:
  - 更偏“编排前计划”而不是 lifecycle CLI 的最小职责
  - 很容易继续牵出 apply / batch / stdin pipeline

### EXT-02 | batch targets / continue-on-error

- Priority: `P3`
- Why deferred:
  - 更像 workflow round-trip 优化，而不是单次 lifecycle 调用的核心职责

### EXT-03 | stdin / pipe / apply

- Priority: `P3`
- Why deferred:
  - 已明显进入 plan -> apply pipeline 范畴
  - 会把 CLI 推向 workflow platform

### EXT-04 | heartbeat / deprecation richer event protocol

- Priority: `P3`
- Why deferred:
  - `cancelled` 已足够支撑当前主线
  - heartbeat / deprecation 更适合作为后续流式协议扩展

### EXT-05 | daemon / HTTP / MCP server

- Priority: `P3`
- Why deferred:
  - 这会把 Quantex 从 lifecycle CLI 推向长期控制面或集成平台
  - 不应与当前主线共享优先级

## 9. 建议顺序

主线剩余工作的建议顺序：

1. `CONTRACT-01` stdout / stderr 契约硬化
2. `LIFECYCLE-01` resolve
3. `RELIABILITY-01` inherited child process termination
4. `STATE-01` 资源锁
5. `TEST-01` 契约测试收口
6. `FRESHNESS-01` 缓存新鲜度与 refresh
7. `UX-01` 可选全局参数

## 10. 结论

Quantex 主线现在应该继续收敛为：

- 默认对人类友好
- 对 AI agent 具备稳定契约
- 专注 agent lifecycle，而不是 workflow orchestration

接下来最重要的不是继续堆“更像平台”的命令，而是把以下三件事收稳：

1. `resolve`，补齐 lifecycle surface
2. `stdout / stderr` 与子进程终止语义，补齐执行契约
3. 契约测试与资源锁，补齐长期维护性

这三件事完成之后，Quantex 的主线就会更像一个轻量、可信、可持续维护的 agent lifecycle CLI。
