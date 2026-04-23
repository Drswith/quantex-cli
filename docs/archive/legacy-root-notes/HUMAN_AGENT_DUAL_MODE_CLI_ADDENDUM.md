# Human + Agent 双模 CLI 设计 · 补遗

## 背景

本文件是 [`HUMAN_AGENT_DUAL_MODE_CLI.md`](./HUMAN_AGENT_DUAL_MODE_CLI.md) 的增补文档。

原文档已经在以下方面给出了完整且合理的方案：

- 双模（human-first + agent-friendly）定位
- 三层架构（resolver → result model → renderer）
- Envelope / error code / exit code
- NDJSON 事件流
- `ensure` / `inspect` / `resolve` / `exec` / `plan` 的新增
- stdout / stderr 约定
- Phase 1-5 的演进路径

本文件**不重复**这些内容，只补充原文档未覆盖或只是一笔带过、但对面向 AI agent 的 CLI 很关键的设计点。

目标是把 "CLI 作为 agent 的公开 API" 这件事再往前推一步：从"让 CLI 能被解析"推到"让 CLI 成为一个稳定、自描述、可组合、可嵌入的 API 表层"。

---

## 指导原则层面：Core + Surfaces

原文档的主语是 "双模 CLI"。建议把主语再抽象一层：

> Quantex 的核心能力只有一份（Core），CLI / JSON output / NDJSON / MCP / RPC / 未来的 HTTP 都是 Surface。

原文档 Phase 1 的"抽 result model 和 renderer"其实已经在往这个方向走，只是没把这个原则**显式写为设计纲要**。把它挑明的收益：

- 所有新 surface（MCP server、daemon 等）都自然复用同一个 result 模型
- 团队不会把新 surface 当作"另一套代码"
- result model 的设计不会被 CLI-specific 细节污染

**建议动作**：在 `AGENTS.md` 的 Architecture 节加一句：

> 所有命令的最终产出是 typed result object，CLI 只是 renderer 之一。未来的 MCP server / daemon / RPC 共享同一份 result model。

---

## 一、契约版本化与自省（Schema & Discoverability）

### 问题

原文档 envelope 里有 `meta.version`，但这是 **CLI 版本**。对 agent 来说更关键的是**输出协议版本**——CLI 版本变不一定意味着 schema 变，schema 变 agent 必须感知。

另外，原文档假设 agent 已经知道有哪些命令、参数、返回结构。真实场景里 agent 需要**自描述能力**来做 feature detection。

### 建议

#### 1.1 Envelope 增加 `schemaVersion`

```json
{
  "ok": true,
  "action": "inspect",
  "data": {},
  "meta": {
    "schemaVersion": "1",
    "version": "0.0.2",
    "runId": "8b8e4f2f",
    "timestamp": "2026-04-22T12:00:00.000Z"
  }
}
```

- `schemaVersion` 只在 envelope 或某个命令返回结构发生**破坏性变更**时提升
- 字段"加"不算 break change，"删/改语义"是 break change
- 破坏性变更前提供 `meta.deprecations`：
  ```json
  "deprecations": [
    { "field": "data.installedAt", "replacement": "data.install.timestamp", "removeIn": "schemaVersion=2" }
  ]
  ```

#### 1.2 新增 `quantex schema` 命令

```bash
quantex schema --json                    # 返回所有命令的输入/输出 JSON Schema
quantex schema --command inspect --json  # 只返回 inspect 命令的 schema
```

用途：

- agent 在启动时一次性拉取、做本地类型校验
- 对接 MCP server 时直接复用
- 写 SDK / type 文件时自动生成

#### 1.3 新增 `quantex commands --json`

返回命令目录，用于 agent 自动发现能力：

```json
{
  "commands": [
    {
      "name": "inspect",
      "summary": "Return structured state of an agent",
      "stability": "stable",
      "flags": [...],
      "outputSchemaRef": "#/definitions/InspectResult"
    }
  ]
}
```

### 原文档可放入的位置

原文档 "推荐命令演进 → B. 新增更适合 agent 编排的命令" 后追加一小节：`quantex schema` 和 `quantex commands`。

---

## 二、能力发现（Capabilities）

### 问题

原文档把"当前平台可用的 installer"信息放在 `doctor` 里。`doctor` 的天然定位是**诊断**（含 severity、suggestedAction），输出带"问题"色彩。

agent 真正需要的是一个**纯只读、无语气、无诊断性质**的能力查询接口，用来做 feature detection，不想先解析一堆 issues。

### 建议

新增 `quantex capabilities --json`：

```json
{
  "ok": true,
  "action": "capabilities",
  "data": {
    "platform": { "os": "macos", "arch": "arm64" },
    "installers": {
      "bun":    { "available": true,  "version": "1.1.30" },
      "npm":    { "available": true,  "version": "10.5.0" },
      "brew":   { "available": true,  "version": "4.2.15" },
      "winget": { "available": false, "reason": "not-on-platform" }
    },
    "agents": ["codex", "claude", "cursor", "gemini"],
    "outputModes": ["human", "json", "ndjson"],
    "features": {
      "dryRun": true,
      "selfUpgrade": true,
      "channels": ["stable", "beta"]
    }
  }
}
```

特点：

- 无副作用
- 无网络依赖（除非显式 `--refresh`）
- 不含 issue / severity / suggestedAction
- 适合作为 agent 启动时的第一次探测

### 和 `doctor` 的边界

- `capabilities`：回答 "你能做什么"
- `doctor`：回答 "当前哪里不对 + 怎么修"

两者可以互相复用底层探测结果，但输出语义不同。

---

## 三、幂等 key 与重试安全

### 问题

原文档提到 `ensure` 是幂等命令，但没涉及**变更型命令在 agent 重试循环里的幂等保证**。典型场景：

- agent 调 `quantex install codex`
- 网络超时，agent 不知道装没装上
- agent 重试 → 可能触发重复安装 / state.json 写冲突

`ensure` 能解决"目标状态式幂等"，但不能解决"同一次调用被重试两次时不产生两次副作用"。

### 建议

对所有变更型命令（`install / update / uninstall / upgrade / exec` 等）支持：

```bash
quantex install codex --idempotency-key 8b8e4f2f-... --json
```

实现要点：

- 本地在 `~/.quantex/idempotency/` 记录 `key → { status, result, expiresAt }`
- TTL 建议 24h
- 同 key 再次调用直接返回上次结果，不重新执行
- key 可由 agent 生成（UUID），也可由 quantex 从 `--run-id` + command hash 推导

### 和 `--run-id` 的关系

`run-id` 是 tracing 用的，可以跨多次调用重用；`idempotency-key` 是防重入用的，应当一次调用一个。两者不冲突。

---

## 四、Run ID 的双向透传

### 问题

原文档里 `runId` 是 CLI 自己生成的。真实 agent 编排里更常见的是：

- agent 有自己的 trace 体系（OTel trace id、workflow id 等）
- agent 调多个 quantex 命令，希望它们串在同一个 trace 上
- agent 事后聚合日志时按 run-id 过滤

CLI 自生成的 run-id 无法满足跨命令串联。

### 建议

- 所有命令接受 `--run-id <id>`，未传则自动生成
- 所有 stdout JSON、所有 stderr 日志、所有 NDJSON 事件都带这个 run-id
- 支持从环境变量继承：`QUANTEX_RUN_ID`
- 推荐在 stderr 日志里以结构化形式打印：`{"ts":"...","level":"info","runId":"...","msg":"..."}`

---

## 五、超时与优雅取消

### 问题

原文档完全没提超时和取消。但 agent 编排几乎必然会遇到：

- 某个 installer 卡住（npm registry 慢、brew 卡在 formula 更新）
- agent 的上层 task 被取消，需要传递下去
- 长任务没心跳，上游判定 hang 而强杀

### 建议

#### 5.1 统一 `--timeout`

```bash
quantex update --all --timeout 300s --output ndjson
```

- 超时后：发 `{"type":"cancelled","reason":"timeout"}` 事件
- 返回 envelope `ok:false, error.code: "TIMEOUT"`，exit code 使用新增的 `10` 或复用 `1`
- **已完成的部分结果仍要返回**：`data.partial.completed: [...]`, `data.partial.pending: [...]`

#### 5.2 SIGTERM / SIGINT 优雅取消

- 收到信号后停止派发新子任务
- 等待正在执行的子任务到安全点
- 输出 `{"type":"cancelled","reason":"signal","signal":"SIGTERM"}`
- 返回 exit code 建议单独分配一个，或复用 `1` + `error.code: "CANCELLED"`

#### 5.3 心跳事件

长任务（update --all、upgrade binary 下载等）在 NDJSON 流里每 5-10s 发一个：

```json
{"type":"heartbeat","runId":"...","seq":42,"stage":"download","progress":0.45}
```

避免上游误判进程 hang。

---

## 六、批量、管道、stdin

### 问题

原文档的例子基本是单 agent 操作（`quantex install codex`、`quantex inspect codex`）。真实 agent 编排经常是批量和管道：

- "把 codex、claude、cursor 都装好" → 希望一次调用返回三个结果，而不是发三次 round-trip
- "plan 出来的计划直接 apply" → 希望 plan 的输出能直接喂给下一个命令

### 建议

#### 6.1 批量参数

让变更型命令支持多 target：

```bash
quantex ensure codex claude cursor --json
```

返回：

```json
{
  "ok": true,
  "action": "ensure",
  "data": {
    "results": [
      { "target": "codex",  "ok": true, "changed": false },
      { "target": "claude", "ok": true, "changed": true, "installSource": "npm" },
      { "target": "cursor", "ok": false, "error": { "code": "MANUAL_ACTION_REQUIRED" } }
    ],
    "summary": { "total": 3, "changed": 1, "failed": 1 }
  }
}
```

注意：**即使有单个失败，整体 `ok` 是否为 `true` 需要明确约定**。建议：

- 默认：任一失败 `ok: false`
- `--continue-on-error`：只要有成功就返回 `ok: true`，失败详情在 `data.results[*].error`

#### 6.2 stdin 接受 JSON

```bash
quantex plan update --all --json \
  | quantex apply --from-stdin --non-interactive --output ndjson
```

实现要点：

- `--from-stdin` 或 `-` 作为 target
- 输入必须是 quantex 自己输出过的 schema（带 `schemaVersion`）
- 读取失败返回 `INVALID_ARGUMENT`

这能让 agent 在"先规划再执行"模式下**零胶水代码**串起来。

---

## 七、缓存与 staleness 提示

### 问题

`list / inspect / upgrade --check` 涉及网络查询（npm registry、GitHub release、brew 等）。现在的设计里 agent 无法判断：

- 这个版本号是刚查的还是 5 小时前的缓存？
- 要不要 `--refresh` 强刷？

### 建议

给含网络查询的 result 加统一的 meta 字段：

```json
"meta": {
  "fetchedAt": "2026-04-22T12:00:00Z",
  "staleAfter": "2026-04-22T13:00:00Z",
  "source": "cache"
}
```

- `source`: `"cache" | "network"`
- `staleAfter`: 基于 `versionCacheTtlHours` 推算
- agent 可以自己决定 "超过 30min 就强刷"

配合全局 `--refresh` / `--no-cache` 两个 flag。

---

## 八、MCP Server 的定位

### 问题

原文档把 MCP server 明确列入"暂不绑定首版"的 "未来值得做" 清单。

对一个**专门管理 AI agent 的工具**来说，这个优先级值得重新考虑：

- MCP 是当前 agent 生态里最标准化的能力发现与调用协议
- quantex 的 `inspect / ensure / resolve / exec / capabilities` **天然就是 MCP tools**
- 一旦 Phase 1 的 result model 抽出来了，包一层 MCP server 的成本极低（预估几天）
- Claude Code、Cursor、Codex 等工具本身就是 MCP consumer，quantex 作为 MCP server 是最自然的集成方式

### 建议

把 MCP server **从"未来再说"移到"Phase 4 或 Phase 5 的候选 Epic"**：

- 不承诺具体时间点
- 但在做 Phase 1 result model 设计时，**显式以 MCP tool schema 为参考**，避免 CLI-specific 细节污染 result 定义
- 新增一个 Phase："MCP Surface"
  - 导出 `quantex mcp serve` 子命令
  - 把现有 result model 直接映射为 MCP tool definitions
  - schema 复用第 1 节的 `quantex schema` 输出

这样演进路径变成：

```
CLI (human + json)  →  NDJSON streaming  →  MCP server  →  (可选) local daemon / RPC
          ↓                 ↓                   ↓
          └──── 共享同一份 Core + Result Model ────┘
```

---

## 九、对 `HUMAN_AGENT_DUAL_MODE_CLI.md` 的微调建议

在不改主干的前提下，以下小改动可以直接 inline 到原文档：

### 9.1 "推荐的全局参数" 节追加

- `--run-id <id>`
- `--timeout <duration>`
- `--idempotency-key <key>`
- `--refresh` / `--no-cache`

### 9.2 "输出协议" envelope 示例里加字段

```json
"meta": {
  "schemaVersion": "1",
  "version": "0.0.2",
  "runId": "8b8e4f2f",
  "timestamp": "2026-04-22T12:00:00.000Z",
  "fetchedAt": "2026-04-22T11:58:00.000Z",
  "source": "network",
  "deprecations": []
}
```

### 9.3 "推荐错误码" 里补几个

- `TIMEOUT`
- `CANCELLED`
- `IDEMPOTENT_REPLAY`（表示这次返回来自幂等缓存，不是新执行）
- `SCHEMA_VERSION_UNSUPPORTED`（用于 `--from-stdin` 读到不兼容的 schema）

### 9.4 "NDJSON 事件流" 里补事件类型

- `heartbeat`
- `cancelled`
- `deprecation`

### 9.5 "关键命令的双模规则" 里补两条

- `capabilities`：纯只读能力查询，无副作用、无 issues
- `schema`：导出 JSON Schema，供 agent 做类型校验

### 9.6 "MVP 建议 → 第二优先级" 调整

把以下项加入第二优先级（而不是"暂不绑定首版"）：

- `quantex capabilities --json`
- `quantex schema --json`
- `--run-id` 透传
- `--timeout`

这四项实现成本低、对 agent 可用性提升大，适合早做。

### 9.7 "暂不绑定首版" 里调整 MCP 的措辞

从"未来值得做"改为"Phase 4/5 候选 Epic，Phase 1 设计时作为参考目标"。

---

## 十、落地清单（合并进原 Phase）

| Phase | 原文档已有 | 本补遗建议追加 |
|---|---|---|
| Phase 0（新增） | - | 在 AGENTS.md 写入 "Core + Surfaces" 原则 |
| Phase 1 | 输出层重构，抽 result model + renderer | envelope 加 `schemaVersion` / `fetchedAt` / `source`；result 类型同时导出为 JSON Schema |
| Phase 2 | 交互策略统一 | 加 `--run-id` / `--timeout` / `--idempotency-key` 三个全局 flag 的 policy 管理 |
| Phase 3 | 错误码与退出码统一 | 补 `TIMEOUT` / `CANCELLED` / `IDEMPOTENT_REPLAY` / `SCHEMA_VERSION_UNSUPPORTED` |
| Phase 4 | 新增 agent-oriented 命令 | 在 `inspect` / `ensure` / `resolve` / `exec` / `plan` 之外，加 `capabilities` / `schema` / `commands` |
| Phase 5 | 测试补齐 | 加 schema 契约测试、idempotency 测试、timeout/cancel 测试、批量操作测试 |
| Phase 6（候选） | - | MCP server surface |

---

## 总结

原文档已经覆盖了"让 CLI 能被 agent 稳定解析"这一层。

本补遗在此之上追加的是：

1. **自描述**（schema / commands / capabilities）
2. **可追踪**（run-id 双向透传、heartbeat）
3. **可控制**（timeout、cancel、idempotency key）
4. **可组合**（批量、stdin、管道）
5. **可演进**（schemaVersion、deprecations）
6. **可嵌入**（MCP surface，共享 Core）

这些增补都是**增量**的，不改变原文档的主干判断——"默认 human-first、增量演进、保留现有体验"仍然是正确的方向。
