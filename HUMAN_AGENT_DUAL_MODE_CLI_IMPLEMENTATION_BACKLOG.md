# Human + Agent 双模 CLI Implementation Checklist / Issue Backlog

> 本文档基于以下讨论文档整理：
>
> - [HUMAN_AGENT_DUAL_MODE_CLI.md](./HUMAN_AGENT_DUAL_MODE_CLI.md)
> - [HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md](./HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md)
>
> 不修改补遗文件内容；这里只做实现拆分、当前状态盘点与 issue backlog 组织。

## 1. 使用方式

本文档面向两类用途：

- 作为 implementation checklist：判断双模 CLI 目前做到哪里、下一步做什么
- 作为 issue backlog：直接拆 Epic、子 issue、PR slice

术语约定：

- `core`：Quantex 的核心能力层，包括 inspection / planning / package-manager / state / self
- `surface`：对外暴露方式，包括 human CLI、JSON、NDJSON、未来的 MCP
- `human mode`：保留当前默认的人类友好交互
- `agent mode`：结构化、非交互、可编排的 surface 行为

状态约定：

- `[x]` 已完成
- `[~]` 部分完成，仍需重构或补齐
- `[ ]` 未开始

优先级约定：

- `P0` 阻塞主链路
- `P1` 高价值，建议紧接落地
- `P2` 完善体验
- `P3` 中长期增强

## 2. 已确认的设计不变量

以下结论视为后续实现的固定前提：

- [x] 默认保留 human-first CLI 体验，不改成 agent-only 工具
- [x] 同一份 core 同时服务 human CLI、JSON、NDJSON，以及未来的 MCP / RPC surface
- [x] 核心逻辑与 renderer 分离，命令最终产出 typed result object
- [x] `quantex <agent>` 继续主要服务人类用户
- [x] `quantex exec <agent> -- [args...]` 作为 agent-safe 的标准执行入口
- [x] agent mode 下必须非交互、可稳定解析、可感知错误类别
- [x] 结果协议需要显式版本化，不能只依赖 CLI version

## 3. 当前基线

截至当前仓库状态，已具备的条件：

- [x] Quantex 已有较完整的 core：`inspection`、`services`、`planning`、`package-manager`、`state`
- [x] 现有命令已覆盖 `install / update / uninstall / list / info / config / upgrade / doctor / quantex <agent>`
- [x] human-friendly 文本输出、彩色提示、快捷启动体验已经可用
- [x] `quantex <agent>` 未安装时会交互确认安装
- [~] `config` 已能输出 JSON，但其他命令仍主要输出人类可读文本
- [ ] 尚无统一 `--json` / `--output ndjson` 全局协议
- [ ] 尚无统一 `--non-interactive` / `--yes` / `--dry-run` 全局策略
- [ ] 尚无统一 envelope / schemaVersion / error code / exit code
- [ ] 尚无 `inspect / ensure / resolve / exec / plan update`
- [ ] 尚无 `schema / commands / capabilities`
- [ ] 尚无 `run-id` / `timeout` / `idempotency-key`
- [ ] 尚无批量命令、stdin 管道、heartbeat / cancel 事件
- [ ] 尚无面向双模 surface 的契约测试体系

## 4. Phase Checklist

### Phase 0 | Core + Surfaces 原则落地

- [ ] 在 `AGENTS.md` 的 Architecture 节写入 `core + surfaces` 原则
- [ ] 明确 typed result object 是命令最终产物，CLI 只是 renderer 之一
- [ ] 在 README 的设计文档入口中补上 backlog 文档链接

### Phase 1 | 结果模型与输出层重构

- [ ] 引入统一 result envelope
- [ ] envelope `meta` 增加 `schemaVersion`
- [ ] envelope `meta` 增加 `runId`、`timestamp`
- [ ] 含网络查询的结果 `meta` 增加 `fetchedAt`、`staleAfter`、`source`
- [ ] 抽离 human / json / ndjson renderer
- [ ] 所有命令改为先返回 result object，再统一渲染
- [ ] result 类型可导出为 JSON Schema

### Phase 2 | 交互策略与全局参数统一

- [ ] 全局支持 `--output <human|json|ndjson>`
- [ ] 全局支持 `--json`
- [ ] 全局支持 `--non-interactive`
- [ ] 全局支持 `--yes`
- [ ] 全局支持 `--quiet`
- [ ] 全局支持 `--color <auto|always|never>`
- [ ] 全局支持 `--log-level <silent|error|warn|info|debug>`
- [ ] 全局支持 `--dry-run`
- [ ] 全局支持 `--run-id <id>`
- [ ] 全局支持 `--timeout <duration>`
- [ ] 全局支持 `--idempotency-key <key>`
- [ ] 全局支持 `--refresh` / `--no-cache`
- [ ] 检测 stdout / stdin 非 TTY 时自动切到 agent-friendly 行为

### Phase 3 | 错误码、退出码、日志契约

- [ ] 引入统一 `CliError` / `ResultError`
- [ ] 定义稳定错误码集合
- [ ] 定义稳定退出码映射
- [ ] `stdout` / `stderr` 契约落地
- [ ] `stderr` 支持带 `runId` 的结构化日志
- [ ] NDJSON 支持 `start / plan / progress / warning / finish`
- [ ] NDJSON 补充 `heartbeat / cancelled / deprecation`

### Phase 4 | Agent-oriented 命令补齐

- [ ] `quantex inspect <agent>`
- [ ] `quantex ensure <agent>`
- [ ] `quantex resolve <agent>`
- [ ] `quantex exec <agent> -- [args...]`
- [ ] `quantex plan update --all`
- [ ] `quantex capabilities --json`
- [ ] `quantex schema --json`
- [ ] `quantex commands --json`

### Phase 5 | 可靠性、组合能力与执行安全

- [ ] 变更型命令支持 `idempotency-key`
- [ ] `run-id` 支持 CLI 参数和环境变量 `QUANTEX_RUN_ID`
- [ ] 统一 timeout 语义
- [ ] 支持 SIGTERM / SIGINT 优雅取消
- [ ] 长任务 NDJSON 增加 heartbeat
- [ ] 支持批量 target，例如 `quantex ensure codex claude`
- [ ] 支持 `--continue-on-error`
- [ ] 支持 `--from-stdin` / `-` 读取 quantex schema 输出
- [ ] 明确 plan → apply 的 schema 兼容策略

### Phase 6 | 测试与文档

- [ ] human vs json snapshot test
- [ ] non-interactive failure test
- [ ] `stdout` / `stderr` contract test
- [ ] error code / exit code test
- [ ] schema contract test
- [ ] batch / stdin / pipe test
- [ ] timeout / cancel / heartbeat test
- [ ] idempotency replay test
- [ ] README 补充双模使用说明
- [ ] README 补充 `exec` 与 `quantex <agent>` 的边界说明

### Phase 7 | MCP Surface 候选 Epic

- [ ] 评估 `quantex mcp serve`
- [ ] 复用 Phase 1 的 result model 和 schema 输出
- [ ] 将 `inspect / ensure / resolve / exec / capabilities` 映射为 MCP tools

## 5. MVP 划分

### MVP-1 | 最小可用 agent mode

- [ ] 全局 `--json`
- [ ] 全局 `--non-interactive`
- [ ] 统一 result envelope
- [ ] 统一 error code / exit code
- [ ] `list / info / install / update / doctor / upgrade` 的 JSON 输出
- [ ] `quantex <agent>` 在 non-interactive 下禁止 prompt

### MVP-2 | 高价值补强

- [ ] `inspect`
- [ ] `ensure`
- [ ] `exec`
- [ ] `capabilities`
- [ ] `schema`
- [ ] `--run-id`
- [ ] `--timeout`
- [ ] `update --all --output ndjson`

### 暂不绑定首版

- [ ] local daemon
- [ ] HTTP surface
- [ ] 遥测平台
- [ ] 多租户或远端 session 管理

## 6. Issue Backlog

## Core / Surface

### SURFACE-01 | 抽离 result model 与 renderer

- Priority: `P0`
- Depends on: 无
- Goal: 让命令逻辑不直接 `console.log`，而是统一返回 typed result object
- Scope:
  - 新建 `src/output/types.ts`
  - 新建 `src/output/renderers.ts`
  - 为 `human / json / ndjson` 提供统一渲染入口
  - 改造现有 commands 先产出 result object
- Acceptance:
  - 命令实现不再内联大量输出逻辑
  - 同一份结果可被 human 和 json renderer 复用
  - 对现有 human 默认行为无回归

### SURFACE-02 | 引入 CLI context 与 interaction policy

- Priority: `P0`
- Depends on: `SURFACE-01`
- Goal: 把交互、输出、颜色、dry-run 等策略从命令逻辑中抽离
- Scope:
  - 新建 `src/cli-context.ts`
  - 新建 `src/interaction/policy.ts`
  - 统一管理 output mode、interactive、install policy、dry-run
- Acceptance:
  - `run` 命令不再直接写死 prompt 行为
  - non-interactive 下不会出现隐藏交互
  - TTY 与非 TTY 行为可测试

### SURFACE-03 | Envelope、schemaVersion 与 stdout/stderr 契约

- Priority: `P0`
- Depends on: `SURFACE-01`
- Goal: 为 agent mode 建立稳定的结构化输出协议
- Scope:
  - 定义 envelope
  - 定义 `meta.schemaVersion`
  - 定义 `stdout` / `stderr` 规则
  - 增加 `fetchedAt` / `staleAfter` / `source`
- Acceptance:
  - `--json` 输出稳定且机器可解析
  - 含缓存的结果能告诉 agent 数据新鲜度
  - 破坏性 schema 变更有版本机制可依赖

## Contracts / Discovery

### DISCOVERY-01 | `capabilities` 命令

- Priority: `P1`
- Depends on: `SURFACE-03`
- Goal: 提供纯只读、无诊断语气的 feature detection 接口
- Scope:
  - 新增 `quantex capabilities --json`
  - 输出 platform、installers、agents、outputModes、features
- Acceptance:
  - 不依赖 `doctor` 文本解析
  - 无副作用
  - 默认无网络依赖，除非显式刷新

### DISCOVERY-02 | `schema` 命令

- Priority: `P1`
- Depends on: `SURFACE-03`
- Goal: 导出所有命令的输入/输出 schema，供 agent 与未来 MCP 复用
- Scope:
  - 新增 `quantex schema --json`
  - 支持 `--command <name>`
  - result 类型导出为 JSON Schema
- Acceptance:
  - schema 可被本地类型校验和 SDK 生成复用
  - schema 与实际命令输出一致

### DISCOVERY-03 | `commands` 命令

- Priority: `P1`
- Depends on: `DISCOVERY-02`
- Goal: 提供命令目录与 flag 自省能力
- Scope:
  - 新增 `quantex commands --json`
  - 输出命令 summary、stability、flags、outputSchemaRef
- Acceptance:
  - agent 可自动发现 quantex 当前支持的命令与稳定级别
  - 无需硬编码命令目录

## Commands / Execution

### EXEC-01 | `inspect`

- Priority: `P1`
- Depends on: `SURFACE-03`
- Goal: 为 agent 提供结构化 agent 状态查询，而不是解析 `info`
- Scope:
  - 新增 `quantex inspect <agent>`
  - 输出 installed/version/latest/path/source/strategy/methods/capabilities
- Acceptance:
  - 能覆盖 `info` 现有关键信息
  - 输出稳定、无需解析文本

### EXEC-02 | `ensure`

- Priority: `P1`
- Depends on: `EXEC-01`
- Goal: 提供目标状态式、幂等的安装命令
- Scope:
  - 新增 `quantex ensure <agent>`
  - 支持 `--dry-run`
  - 返回 `changed`
- Acceptance:
  - 已安装时直接成功
  - 未安装时才执行安装
  - 结果明确标识是否发生变更

### EXEC-03 | `resolve`

- Priority: `P1`
- Depends on: `EXEC-01`
- Goal: 提供可执行 binary 的结构化解析结果
- Scope:
  - 新增 `quantex resolve <agent>`
  - 输出 binaryName、binaryPath、installedVersion、installSource、suggestedLaunchCommand
- Acceptance:
  - 上游 runtime 无需自行探测 PATH
  - resolve 失败时有稳定错误码

### EXEC-04 | `exec`

- Priority: `P1`
- Depends on: `SURFACE-02`, `EXEC-02`, `EXEC-03`
- Goal: 提供 agent-safe 的标准执行入口，并与 human shortcut 明确分工
- Scope:
  - 新增 `quantex exec <agent> -- [args...]`
  - 支持 `--install <never|if-missing|always>`
  - 支持 `--cwd` / `--env`
  - 明确 `--` 之后参数透传规则
- Acceptance:
  - 不再与下游 agent flag 产生歧义
  - non-interactive 下不会弹 prompt
  - human shortcut 行为保留

### EXEC-05 | `plan update --all`

- Priority: `P1`
- Depends on: `SURFACE-03`
- Goal: 让 agent 可以先规划、再决定是否执行
- Scope:
  - 新增 `quantex plan update --all`
  - 输出 up-to-date / managed / self-update / manual-hint / package buckets
- Acceptance:
  - 计划结果可解释且可测试
  - 可与后续 apply / stdin 模式组合

## Reliability / Streaming

### RELIABILITY-01 | `run-id`、`timeout`、`idempotency-key`

- Priority: `P1`
- Depends on: `SURFACE-02`, `SURFACE-03`
- Goal: 让 CLI 在 agent 编排和重试循环里可追踪、可控制、可防重入
- Scope:
  - 支持 `--run-id`
  - 支持 `QUANTEX_RUN_ID`
  - 支持 `--timeout`
  - 支持 `--idempotency-key`
  - 本地 idempotency 记录与 TTL
- Acceptance:
  - 同一 `idempotency-key` 重试不会重复执行副作用
  - timeout 会返回稳定错误
  - 日志与结果里可关联 run-id

### RELIABILITY-02 | NDJSON heartbeat / cancel / deprecation

- Priority: `P1`
- Depends on: `SURFACE-03`
- Goal: 让长任务不会被上游误判 hang，并支持优雅取消
- Scope:
  - NDJSON 增加 `heartbeat`
  - 增加 `cancelled`
  - 增加 `deprecation`
  - SIGTERM / SIGINT 优雅取消
- Acceptance:
  - 长任务有周期性心跳
  - 超时或信号取消后返回部分结果与稳定错误码

### RELIABILITY-03 | 缓存新鲜度与 `--refresh`

- Priority: `P2`
- Depends on: `SURFACE-03`
- Goal: 让 agent 知道版本数据是来自缓存还是刚查询
- Scope:
  - `meta.fetchedAt`
  - `meta.staleAfter`
  - `meta.source = cache | network`
  - 全局 `--refresh` / `--no-cache`
- Acceptance:
  - 版本查询结果的时效性可判断
  - agent 可以自主决定是否强刷

## Batch / Pipe

### BATCH-01 | 批量 target 与 continue-on-error

- Priority: `P2`
- Depends on: `EXEC-02`, `EXEC-05`
- Goal: 降低 agent 编排的 round-trip 成本
- Scope:
  - `quantex ensure codex claude cursor`
  - 批量 install / update / inspect
  - `--continue-on-error`
  - summary 结构
- Acceptance:
  - 单个失败不会让所有结构化结果丢失
  - 成功与失败都有独立结果对象

### BATCH-02 | stdin / pipe / apply

- Priority: `P2`
- Depends on: `EXEC-05`, `DISCOVERY-02`
- Goal: 让 quantex 自己的计划输出能零胶水地喂给下一个命令
- Scope:
  - `--from-stdin` 或 `-`
  - 读取 quantex 自身输出的 schema
  - 规划结果可 pipe 到执行命令
- Acceptance:
  - schema 不兼容时返回 `SCHEMA_VERSION_UNSUPPORTED`
  - plan → apply 管道路径可测试

## Docs / Tests / MCP

### DOCS-01 | README / AGENTS / examples 收敛

- Priority: `P2`
- Depends on: `SURFACE-02`, `EXEC-04`
- Goal: 让 human-first 与 agent-friendly 的边界在文档里说清楚
- Scope:
  - README 增加 dual-mode 章节
  - AGENTS.md 写入 `core + surfaces`
  - 示例覆盖 human shortcut 与 `exec`
- Acceptance:
  - 文档能明确区分 human shortcut 与 agent-safe surface
  - 不要求读源码才能理解参数边界

### TEST-01 | 契约测试套件

- Priority: `P1`
- Depends on: `SURFACE-03`, `EXEC-05`
- Goal: 用测试保证 dual-mode 契约长期稳定
- Scope:
  - snapshot tests
  - exit code tests
  - schema tests
  - timeout / cancel / batch / idempotency tests
- Acceptance:
  - 结构化输出变化需要显式更新 snapshot
  - schema 与实现不一致时测试失败

### MCP-01 | MCP Surface 候选实现

- Priority: `P3`
- Depends on: `DISCOVERY-02`, `DISCOVERY-03`, `EXEC-04`
- Goal: 基于同一份 result model 暴露 MCP tools
- Scope:
  - `quantex mcp serve`
  - 映射 `inspect / ensure / resolve / exec / capabilities`
  - 复用现有 schema 输出
- Acceptance:
  - MCP tool schema 与 CLI schema 同源
  - 不复制第二套业务逻辑

## 7. 建议落地顺序

建议顺序：

1. `SURFACE-01` result model + renderer
2. `SURFACE-02` cli context + interaction policy
3. `SURFACE-03` envelope + schemaVersion + stdout/stderr contract
4. `EXEC-01` inspect
5. `EXEC-02` ensure
6. `EXEC-04` exec
7. `DISCOVERY-01` capabilities
8. `DISCOVERY-02` schema
9. `RELIABILITY-01` run-id / timeout / idempotency-key
10. `EXEC-05` plan update --all
11. `RELIABILITY-02` heartbeat / cancel
12. `BATCH-01` batch target
13. `BATCH-02` stdin / pipe
14. `TEST-01` 契约测试收口
15. `MCP-01` 候选 epic

## 8. 建议 PR 切分

建议按以下粒度提交，降低 review 风险：

1. `PR-1`：`SURFACE-01`
2. `PR-2`：`SURFACE-02` + 全局 flags
3. `PR-3`：`SURFACE-03`
4. `PR-4`：`EXEC-01` + `EXEC-02`
5. `PR-5`：`EXEC-04`
6. `PR-6`：`DISCOVERY-01` + `DISCOVERY-02`
7. `PR-7`：`RELIABILITY-01`
8. `PR-8`：`EXEC-05` + NDJSON events
9. `PR-9`：`BATCH-01` + `BATCH-02`
10. `PR-10`：`TEST-01`
11. `PR-11`：`MCP-01`

## 9. 最终结论

这条线的本质不是把 Quantex 从 human CLI 改造成 agent-only 工具，而是把它演进成：

- 默认对人类友好
- 对 AI agent 具备稳定契约
- 同时可作为未来 MCP / RPC surface 的共用 core

工程上最重要的不是先加多少新命令，而是先把以下三件事收稳：

1. result model / renderer 分层
2. 非交互与结构化输出契约
3. 错误码、schemaVersion 与执行安全模型

这三件事稳定之后，`inspect / ensure / exec / capabilities / schema` 才会真正成为可长期维护的 agent surface，而不是在现有 human CLI 上继续堆 option。
