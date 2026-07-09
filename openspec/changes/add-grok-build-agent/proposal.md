## Why

xAI 已公开 Grok Build（终端编码 agent / CLI），官方文档提供跨平台安装脚本与 `grok update` 自更新。用户期望能像其他受支持 agent 一样通过 `quantex install grok` / `qtx grok` 完成生命周期管理。当前 catalog 尚未收录该 agent。

Work-intake classification: agent catalog fields、install methods、update strategy、version probing，以及 product-facing README/matrix 同步，必须走 OpenSpec。

## What Changes

- 将 Grok Build 加入受支持 agent catalog，canonical slug 为 `grok`。
- 暴露查找别名 `grok-build`（产品名变体）；不将 `agent` 设为别名，因其已被 Cursor CLI 占用。
- 记录官方安装脚本（macOS/Linux curl、Windows PowerShell）、可执行二进制 `grok`、version probe `grok --version`、self-update `grok update`。
- 不发明上游未文档化的 npm/brew/bun 等 managed install 路径。
- 补充 focused catalog/export 测试，并同步 README、agent-support-matrix 与 skill 参考列表。

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: 将 Grok Build 列为受支持的 lifecycle agent。

## Impact

- `src/agents/catalog/` 与 generated catalog exports 新增 `grok` 条目。
- `src/agents/index.ts` 与 `src/index.ts` 重新导出该 catalog agent。
- `test/agents.test.ts` 与 `test/index.test.ts` 覆盖 lookup、metadata、install methods 与 exports。
- `README.md` / `README.zh-CN.md`、`docs/agent-support-matrix.md`、skill 参考列表同步展示。
- `openspec/specs/agent-catalog/spec.md` 在 archive closure 时纳入已接受的 Grok Build 契约。
