# Human + Agent 双模 CLI 设计

## 背景

Quantex CLI 当前已经具备较完整的 agent 管理内核：

- agent registry
- inspection / planning / state
- install / update / uninstall
- self upgrade

但现有命令层主要仍是面向人类终端用户设计：

- 默认输出以彩色文本和可读排版为主
- `quantex <agent>` 在未安装时会弹交互确认
- 命令结果更适合“阅读”，不适合“稳定解析”
- 失败原因以文案表达为主，缺少稳定错误码与结构化上下文

这并不意味着方向错了。相反，Quantex 现阶段更适合采用“双模设计”而不是“agent-only 重做”：

- 保留 human-friendly CLI 作为默认体验
- 增加 agent-friendly 接口层，让 AI agent 能安全、稳定、非交互地调用

目标不是把 CLI 变得“没人味”，而是让同一个工具既适合人直接使用，也能作为 agent 可稳定依赖的 lifecycle CLI。

## 设计目标

### 1. 保留人类友好体验

- 默认仍输出彩色、简洁、可读的文本
- 默认仍保留提示、确认、摘要和恢复建议
- 现有命令名和快捷入口尽量不破坏

### 2. 增加 agent 友好能力

- 所有关键命令支持结构化输出
- 所有关键命令支持非交互运行
- 所有关键命令具备稳定的错误分类和退出码
- 提供幂等、目标状态式、可重试的命令语义

### 3. 基于现有架构增量演进

- 复用已有的 `inspection`、`services`、`planning`、`package-manager`
- 主要重构 CLI 契约层，而不是推倒底层能力
- 让 human mode 和 agent mode 共用同一套核心结果模型

## 非目标与边界

Quantex 主线明确收敛为：

- `human-friendly + agent-friendly` 的 agent lifecycle CLI
- 聚焦安装、检查、确保可用、更新、卸载、能力发现、结构化执行契约

以下能力不纳入当前主线目标：

- workflow orchestration
- plan → apply pipeline
- 批量 target 协议
- stdin / pipe 驱动的执行编排
- daemon / server / MCP surface

这些能力未来可以讨论，但应作为扩展议题存在，而不是挤占主线设计。

## 核心原则

### 默认 human mode，显式支持 agent mode

Quantex 的默认行为仍然是 human-first：

- TTY 中默认输出 `human`
- TTY 中允许交互确认
- 保留当前的彩色文本与摘要风格

当满足以下任一条件时，进入 agent-friendly 行为：

- 显式传入 `--json`
- 显式传入 `--output json`
- 显式传入 `--output ndjson`
- 显式传入 `--non-interactive`
- 检测到 stdout / stdin 非 TTY

### 核心能力与展示层分离

命令执行应拆成三层：

1. `resolver / service layer`
   负责查询、规划、执行
2. `result model`
   负责把结果组织成统一结构
3. `renderer`
   根据模式渲染为 human text / JSON / NDJSON

这能避免每个命令都把业务逻辑和 `console.log` 混在一起。

### 交互是策略，不是业务逻辑

例如“未安装时是否自动安装”不应写死在 `run` 命令内部，而应由策略控制：

- human mode: 可以提示确认
- non-interactive mode: 不允许弹 prompt
- agent mode: 通过 flag 明确指示 `never` / `if-missing` / `always`

## 推荐的全局参数

建议为所有命令增加统一全局参数：

- `--output <human|json|ndjson>`
- `--json`
- `--non-interactive`
- `--yes`
- `--quiet`
- `--color <auto|always|never>`
- `--log-level <silent|error|warn|info|debug>`
- `--dry-run`

建议的语义：

- `human`：默认模式，保留现有文本体验
- `json`：一次性结构化输出，适合脚本和 agent 解析
- `ndjson`：按事件逐行输出 JSON，适合长任务和流式消费
- `--non-interactive`：禁止 prompt；若命令需要确认而未给出明确策略，则直接失败
- `--yes`：允许在需要确认时自动接受默认安全选项
- `--quiet`：压缩非必要日志，但不影响最终结果对象
- `--dry-run`：只返回计划，不执行变更

## 双模行为设计

### Human mode

保留当前交互体验，并继续优化：

- 彩色文本
- 可读表格或列表
- 适度提示下一步操作
- 失败时展示修复建议
- 长任务展示阶段性文案

### Agent mode

Agent mode 强制满足以下约束：

- 不弹交互 prompt
- `stdout` 只输出结构化结果
- 进度日志与警告走 `stderr` 或 NDJSON event
- 所有失败返回稳定 error code
- 所有结果返回明确 action、target、status、next steps

## 推荐命令演进

### A. 保留现有命令，并补充双模能力

现有命令继续保留：

- `install`
- `update`
- `uninstall`
- `list`
- `info`
- `config`
- `upgrade`
- `doctor`
- `quantex <agent>`

但所有命令都应支持 `--json` / `--non-interactive` / `--dry-run` 等统一参数。

### 示例

人类用户：

```bash
quantex list
quantex update --all
quantex claude
```

agent：

```bash
quantex list --json
quantex update --all --output ndjson --non-interactive
quantex exec codex --install=if-missing --non-interactive --json -- --help
```

### 参数边界约定

为了避免 Quantex 自己的 flag 与下游 agent 的 flag 混淆，建议明确：

- `quantex <agent>` 继续主要服务于人类用户
- `quantex exec <agent> -- [args...]` 作为 agent 的标准执行入口
- `--` 之后的参数全部透传给下游 agent

这样可以避免诸如 `--json`、`--help`、`--model` 这类参数到底属于 Quantex 还是属于 agent 的歧义。

### B. 新增更适合 agent 生命周期管理的命令

建议补充以下命令，而不是强迫 agent 复用 `info` 这种偏阅读型接口。

### `quantex inspect <agent>`

用于返回某个 agent 的完整结构化状态：

- 是否已安装
- 当前版本
- 最新版本
- binary path
- 安装来源
- 更新策略
- 当前平台可用安装方式
- 可否自动安装 / 更新 / 卸载

适合替代当前 agent 对 `info` 文本输出的解析。

### `quantex ensure <agent>`

幂等命令。

语义：

- 已安装则直接成功
- 未安装则执行安装
- 可配合 `--dry-run`

这个命令比 `install` 更适合 agent，因为 agent 更关心目标状态，而不是用户动作。

### `quantex resolve <agent>`

返回“当前可执行哪个 binary”及其运行上下文：

- binary name
- binary path
- installed version
- install source
- suggested launch command

适合作为上游 agent runtime 的前置探测。

### `quantex exec <agent> -- [args...]`

提供显式的 agent-safe 执行入口。

建议支持：

- `--install <never|if-missing|always>`
- `--non-interactive`
- `--cwd <path>`
- `--env KEY=VALUE`
- `--json`

与当前快捷启动的关系：

- `quantex <agent>`：继续作为 human-friendly shortcut
- `quantex exec <agent>`：作为 agent-friendly 明确入口

### 不纳入主线的候选能力

以下能力和主线目标有关，但不应进入当前主线范围：

- `quantex plan update --all`
- `apply --from-stdin`
- 批量 target
- server / daemon / MCP surface

如果未来需要推进，应单独作为 extension track 讨论，而不是和 lifecycle CLI 主线混做一条线。

## 输出协议

建议所有 `--json` 输出统一为 envelope：

```json
{
  "ok": true,
  "action": "inspect",
  "target": {
    "kind": "agent",
    "name": "codex"
  },
  "data": {},
  "warnings": [],
  "error": null,
  "meta": {
    "mode": "json",
    "version": "0.0.2",
    "runId": "8b8e4f2f",
    "timestamp": "2026-04-22T12:00:00.000Z"
  }
}
```

其中：

- `ok`：成功或失败
- `action`：本次动作，例如 `list` / `inspect` / `ensure` / `update`
- `target`：动作目标
- `data`：主要结果
- `warnings`：非致命问题
- `error`：结构化错误
- `meta`：运行元数据

### `error` 对象建议

```json
{
  "code": "AGENT_NOT_FOUND",
  "message": "Unknown agent: foo",
  "details": {
    "input": "foo"
  }
}
```

建议先引入一小套稳定错误码：

- `INVALID_ARGUMENT`
- `AGENT_NOT_FOUND`
- `AGENT_NOT_INSTALLED`
- `INSTALLER_UNAVAILABLE`
- `INTERACTION_REQUIRED`
- `INSTALL_FAILED`
- `UPDATE_FAILED`
- `UNINSTALL_FAILED`
- `NETWORK_ERROR`
- `STATE_LOCK_CONFLICT`
- `MANUAL_ACTION_REQUIRED`
- `INTERNAL_ERROR`

## NDJSON 事件流

对于安装、更新、升级这类长任务，建议支持：

```bash
quantex update --all --output ndjson
```

每行一个事件，例如：

```json
{"type":"start","action":"update-all","runId":"8b8e4f2f"}
{"type":"plan","managed":["codex","claude"],"manual":["cursor"]}
{"type":"progress","stage":"update","agent":"codex","strategy":"managed/npm"}
{"type":"progress","stage":"update","agent":"claude","strategy":"self-update"}
{"type":"warning","code":"MANUAL_ACTION_REQUIRED","agent":"cursor"}
{"type":"finish","ok":true}
```

这比一次性文本输出更适合 agent 做流式决策、重试和上报。

## `stdout` / `stderr` 约定

为了让 agent 调用更稳定，建议统一约束：

- human mode：`stdout` 输出人类可读结果，必要时混合提示
- `--json`：`stdout` 只输出最终 JSON
- `--output ndjson`：`stdout` 只输出事件流
- `stderr`：用于 debug log、补充警告、安装器原生命令日志

如果后续希望更严格，也可以增加：

- `--installer-log <inherit|stderr|suppress>`

用于控制底层包管理器输出如何暴露给上层。

## 退出码设计

建议引入稳定退出码：

- `0`：成功
- `1`：通用失败
- `2`：参数错误
- `3`：目标不存在，例如 agent 未找到
- `4`：目标状态不满足，例如未安装
- `5`：外部依赖不可用，例如 bun / npm / brew 不可用
- `6`：网络或远端查询失败
- `7`：需要交互但当前禁止交互
- `8`：需要手动操作，未能自动完成
- `9`：锁冲突或并发冲突

agent 不应依赖文案判断失败原因，而应依赖退出码和 `error.code`。

## 关键命令的双模规则

### `list`

human mode：

- 保留当前简洁列表输出

agent mode：

- 返回数组，包含每个 agent 的安装状态、版本、来源、更新策略

### `info`

human mode：

- 继续作为阅读型详情页

agent mode：

- 可保留 `info --json`
- 但更推荐新增 `inspect`

### `install`

human mode：

- 已安装时给出友好提示
- 安装过程显示摘要和结论

agent mode：

- 返回明确的 `changed: true | false`
- 包含实际采用的安装方法、来源记录结果、失败原因

### `update`

human mode：

- 保留当前 summary 风格

agent mode：

- 返回每个 agent 的结果数组
- 区分 `updated` / `up-to-date` / `manual-required` / `failed`

### `quantex <agent>`

human mode：

- 保持未安装时交互确认

agent mode：

- 不允许 prompt
- 默认行为建议为：
  - 若显式指定 `--install=if-missing`，则自动安装
  - 若未指定，则返回 `INTERACTION_REQUIRED` 或 `AGENT_NOT_INSTALLED`

这能保留现在的人类体验，同时避免 agent 被无提示阻塞。

### `doctor`

human mode：

- 保留“问题 + 修复建议”式输出

agent mode：

- 返回 installer availability、自升级状态、agent 状态、issues 数组
- 每个 issue 带 `severity`、`code`、`message`、`suggestedAction`

## 幂等性与目标状态语义

面向 agent 的 CLI，最好尽量提供“目标状态”语义：

- `ensure`
- `--dry-run`

建议对变更型命令返回：

- `changed`
- `result`

例如：

```json
{
  "ok": true,
  "action": "ensure",
  "data": {
    "changed": false,
    "installed": true,
    "installSource": "npm"
  }
}
```

## 并发与状态安全

Quantex 若要被多个终端、多个自动化调用或多个 agent 进程同时调用，需要提前考虑：

- `~/.quantex/state.json` 写入锁
- install / update / uninstall 的资源锁
- 明确“正在执行中的操作”冲突返回

建议引入轻量级 state lock，至少保护：

- state 文件写入
- agent 安装与卸载
- self upgrade

## 配置层建议

为了不影响现有用户，默认配置仍保持 human-first。

可新增但不强制暴露的配置项：

```json
{
  "defaultOutputMode": "human",
  "nonInteractiveDefaultInstallPolicy": "never",
  "defaultLogLevel": "info"
}
```

原则：

- 默认值服务于人类用户
- agent 用户通过 flag 显式覆盖
- 不依赖隐式配置推断危险行为

## 推荐实现路径

### Phase 1: 输出层重构

目标：

- 不改业务语义，先把结果对象和渲染器抽出来

建议新增：

- `src/output/types.ts`
- `src/output/renderers.ts`
- `src/output/json.ts`

建议改造：

- `src/commands/install.ts`
- `src/commands/update.ts`
- `src/commands/uninstall.ts`
- `src/commands/list.ts`
- `src/commands/info.ts`
- `src/commands/doctor.ts`
- `src/commands/upgrade.ts`
- `src/commands/run.ts`

改造方式：

- command 返回 typed result
- CLI 层根据全局 option 选择 renderer

### Phase 2: 交互策略统一

目标：

- 把 prompt 行为从命令逻辑中拆出来

建议新增：

- `src/cli-context.ts`
- `src/interaction/policy.ts`

由 context 统一提供：

- output mode
- interactive / non-interactive
- color policy
- install policy
- dry-run

### Phase 3: 错误码与退出码统一

建议新增：

- `src/errors.ts`

统一：

- typed CLI error
- error code 到 exit code 的映射
- renderer 对错误对象的格式化

### Phase 4: 新增 agent-oriented 命令

优先顺序建议：

1. `inspect`
2. `ensure`
3. `resolve`
4. `exec`

原因：

- `inspect` 和 `ensure` 最容易复用现有内核
- `resolve` 能减少上层 runtime 猜测
- `exec` 能把当前隐式 shortcut 变成显式契约
- 主线先收敛在单次调用可靠性，而不是扩展到编排型 plan/apply

### Phase 5: 测试补齐

除现有命令测试外，新增：

- human vs json snapshot test
- non-interactive failure test
- `stdout` / `stderr` contract test
- error code / exit code test
- `ensure` 幂等测试
- timeout / cancel / idempotency test

## MVP 建议

如果只做一个最小但高价值的首版，建议范围是：

### 必做

- 全局 `--json`
- 全局 `--non-interactive`
- 统一 result envelope
- 统一 error code / exit code
- `list` / `info` / `install` / `update` / `doctor` 的 JSON 输出
- `quantex <agent>` 在 non-interactive 下禁用 prompt

### 第二优先级

- `inspect`
- `ensure`
- `--dry-run`
- `update --all --output ndjson`

### 不进入主线

- `plan update --all`
- batch target
- stdin / pipe / apply
- daemon 模式
- MCP server
- 长驻后台任务
- 复杂并发调度
- 完整遥测体系

这些能力可以作为扩展方向保留，但不应阻塞 agent lifecycle CLI 主线。

## 对当前代码结构的判断

Quantex 现在最好的地方，是底层已经不是“脚本拼接式 CLI”了，而是已经有：

- `inspection`
- `services`
- `planning`
- `package-manager`
- `state`

这意味着：

- 不需要重写核心能力
- 主要需要整理命令契约层
- 最适合用“结果对象 + 渲染器 + 交互策略”做增量演进

换句话说，Quantex 下一阶段不该从“人类 CLI”跳到“纯 agent CLI”，而应该演进为：

“默认对人类友好，同时对 AI agent 具有稳定契约的 agent lifecycle CLI”

这会比单纯增加几个 `--json` flag 更完整，也比彻底改成 agent-only 工具更符合 Quantex 当前产品定位。
