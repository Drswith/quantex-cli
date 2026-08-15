## Context

`origin/main` 当前包含桌面客户端主体 PR #557、其 OpenSpec 归档 PR #647、外观模式 PR #649 和归档 PR #651。主体 PR 同时引入了 `apps/desktop`、桌面 sidecar 和 CI、workspace/依赖变更，以及仅由桌面端使用的 managed-only 更新 CLI 扩展；外观模式是建立在主体客户端上的增量。

目标是让 Quantex 回到单一 CLI 产品面，同时保留已发布提交的历史可追溯性。主分支受保护，因此实现必须从当前 `origin/main` 建立分支，通过 PR 合入，不能重写主分支历史或移动版本 tag。

## Goals / Non-Goals

**Goals:**

- 完整移除桌面客户端的源码、构建、测试、依赖、CI 和 package/release 入口。
- 删除桌面专用的 managed-only 更新模式，恢复桌面特性之前的 CLI 行为和契约。
- 通过显式 Revert 提交保留对 #557、#647、#649、#651 的历史关联。
- 用 OpenSpec 记录产品边界收缩及后续 archive closure 所需的契约变化。

**Non-Goals:**

- 不回退普通 CLI 生命周期能力、已有 `update --all` 语义或非桌面相关的更新修复。
- 不删除 Git 历史、移动 tag、回滚 v1.10.0 release commit 或手工改写历史 changelog。
- 不引入新的 GUI 替代方案，也不把 CLI 改造成 workflow orchestration platform。

## Decisions

1. **按合入逆序回滚四个相关 PR。** 先回滚 #651、#649，再回滚 #647、#557，并对每个 merge commit 使用主线父节点作为主线基准。这样可以先撤掉外观模式和归档，再撤掉产生它们的实现与主体，最大限度复原桌面前状态。

   替代方案是手工挑选文件删除或回退整个 release commit；前者容易遗漏 CLI 契约和锁文件，后者会误伤无关发布内容，因此不采用。

2. **OpenSpec change 与 Revert 提交同 PR 交付。** 新 change 以 delta 形式记录桌面能力及三个受影响现有 capability 的移除，合并后按运行时规则执行 archive closure。

   替代方案是只删除源码、不记录契约变化；这会留下过时的产品边界和 OpenSpec 依据，因此不采用。

3. **保留历史发布记录。** 不从 `CHANGELOG.md` 删除已经发生的 v1.10.0 条目，也不移动 tag；回滚行为交给后续 release automation 生成新的 release 记录。

## Risks / Trade-offs

- [Revert 上下文冲突] 后续提交可能修改了桌面特性触及的共享文件 → 先核对四个 merge commit 的文件差异和后续路径历史；如有冲突只保留非桌面 CLI 变更，并用测试确认。
- [误删 CLI 更新能力] 主体 PR 同时改动了 `update` → 对比桌面前父提交，保留普通单 agent/全量更新和现有生命周期逻辑，运行 CLI test 与结构化契约测试。
- [锁文件残留桌面依赖] 只回退源码而不回退 workspace lock 会继续扩大安装面 → 以 `package.json`、`bun.lock`、workspace 校验和 `rg` 交叉检查，并使用 frozen install 验证。
- [归档后 spec 漂移] 删除归档产物可能让当前规格与实现不一致 → 在 PR 中保留 removal change，合并后执行 OpenSpec archive closure，不保留已不存在能力的当前 spec。

## Migration Plan

1. 从 `origin/main` 创建 `codex/revert-desktop-ui`。
2. 生成 removal OpenSpec artifacts。
3. 按 #651、#649、#647、#557 的顺序生成 Revert 提交，并审查最终 diff。
4. 运行 lint、format check、typecheck、test、OpenSpec 和 memory 校验。
5. 提交、推送并创建 PR；等待受保护分支 CI 通过后按仓库策略合入。
6. 合并后从干净主线执行 OpenSpec archive closure，并确认没有桌面源码、构建入口或现行 capability 残留。

## Open Questions

无。桌面 UI 的后续产品方向不在本次回滚范围内；如果未来重新提出，应作为新的产品决策和 OpenSpec change 评估。
