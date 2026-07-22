# Lifecycle Integration Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task by task, `superpowers:test-driven-development` for behavior changes, and `superpowers:verification-before-completion` before every delivery claim.

**Goal:** 建立长期 `codex/redesign-lifecycle-integration` 集成线，使生命周期引擎重构按独立里程碑进入受保护的 integration 分支；在全部 74 项实现任务、兼容性验证和发布验证完成前，不让重构代码进入 `main` 或触发 npm 发布。

**Architecture:** `main` 继续是正式发布源；integration 是从 `main` 派生、只接收受审 PR 的临时聚合分支。普通里程碑分支始终从最新 integration 建立，并以单提交 PR 合入 integration。只有两个精确、同仓库拓扑允许多提交 PR：`main -> integration` 的定期同步，以及 `integration -> main` 的最终提升。所有剩余 PR 统一 rebase 优先、squash 其次，agent 或 automation 不得自动选择 merge commit；同步与提升以 expected tree 和内容比较取代祖先/双亲验收。CI 和 Sandbox 只为“目标分支是 integration”的 PR 增加触发，integration 的 push 永远不进入 CI push 或 Release 发布触发。

**Tech Stack:** Bun 1.3.11、TypeScript、Vitest、GitHub Actions、GitHub Rulesets、OpenSpec 1.3.1、Git/GitHub CLI。

---

## 已确认基线（2026-07-10）

- `origin/main` 为 `0a972812f209a6c335b41ddecfc22901dc77099c`。
- 当前 worktree 位于 `codex/redesign-lifecycle-engine`，HEAD 为 `882e248ea07a0cbfd98179aa91e6ee86b5a0153b`，相对 `origin/main` ahead 8 / behind 0，工作树在本计划落盘前为 clean，分支没有 upstream，远端没有同名分支或 PR。
- `codex/redesign-lifecycle-integration` 本地和远端均不存在。
- `redesign-lifecycle-engine` 为 active，OpenSpec artifacts 完整，实施进度 `8/74`；它必须跨所有里程碑保持 active。
- CI 和 Sandbox 的 `pull_request.branches` 目前只包含 `main`、`beta`；PR Governance 没有 base-branch filter，已经覆盖所有 PR。
- Release 的 `workflow_run.branches`、手动发布选项以及 Release PR 自动合并只包含 `main`、`beta`。不得加入 integration。
- `scripts/pr-merge-commit-policy.ts` 当前拒绝所有多提交 PR；这会阻断定期同步和最终提升，因此需要精确、可测试的拓扑例外。
- GitHub 当前 `protect-main` ruleset 要求 PR、禁止 non-fast-forward，并要求六个检查：`classify`、`lint`、`test (ubuntu-latest)`、`test (windows-latest)`、`test (macos-latest)`、`sandbox-tests`。integration 应建立独立临时 ruleset 镜像这组实际检查，不顺带扩大 main 的治理范围。

## 执行状态（2026-07-11）

- process-only bootstrap 已通过 PR #442 以单提交合入 `main`，merge SHA 为 `646d58e7b9b7d4f37aa13a1d0d90753f74aadee0`；六项 main gate 和 Sandbox 均成功，Release 未发布 npm 包、tag 或 GitHub Release。
- `codex/redesign-lifecycle-integration` 已在保护前精确快进到同一 SHA，远端与 `main` 的 live comparison 为 `0 0`；该 push 未触发 CI、Sandbox Tests 或 Release。
- 临时规则集 `protect-lifecycle-integration`（ID `18789571`）已启用，精确匹配 integration ref，禁止绕过和 non-fast-forward，并镜像 `protect-main` 的 PR 规则与六项 required contexts。
- prerequisite PR #443 已通过六项 required contexts、独立 PR Governance 和 Cursor review，以普通单提交路径合入 integration（`925e6b00fd01c710ed1fa006541ad1c9affdf9aa`）；integration push 仍未触发 CI、Sandbox Tests 或 Release。
- Phase 0/1 已刷新到该受保护 integration 基线，正在规范化为一个独立里程碑提交。
- 2026-07-11 合并方法已按用户最新决定修正：后续所有 PR rebase 优先、squash 其次；不得由 agent 或 automation 自动选择 merge commit，也不再用 source-tip 祖先关系或双亲提交作为同步/提升完成证据。

## 全局不变量

1. `beta` 不参与本策略。
2. integration 的精确分支名只有 `codex/redesign-lifecycle-integration`；禁止通配符，避免意外覆盖其他 `codex/*` 分支。
3. integration 只进入 CI/Sandbox 的 `pull_request` 目标列表，不进入任何 `push` 发布链或 Release workflow。
4. 普通里程碑 PR 保持单提交；`main -> integration` 同步 PR 和 `integration -> main` 最终提升 PR 可保持多提交。所有剩余 PR 一律先选 rebase，只有 rebase 不可用或不安全时才记录原因并选 squash；禁止 agent 或 automation 自动选择 merge commit。
5. 每个里程碑在独立 worktree/分支中实施，拥有自己的计划、测试证据、spec review、code-quality review、PR 和精确 OpenSpec checkbox 更新。
6. `redesign-lifecycle-engine` 与本计划新增的交付策略 change 都保持 active；任何单个里程碑合并都不构成 archive 条件。
7. integration 的同步、保护、PR 和最终提升均使用远端实时状态作为依据，不依赖本地缓存判断。
8. 任意失败先按 `superpowers:systematic-debugging` 定位根因；不得通过弱化测试、扩大例外或跳过 gate 继续。
9. 本计划已经用户确认；执行按任务检查点推进，并把远端 live state 与 OpenSpec checkbox 作为交付记录。

---

## Task 1: 从执行时最新 `main` 建立并推送 integration

**Files:** 无。

**Step 1: 重新获取实时基线**

```bash
git fetch origin --prune
git status --short --branch
git rev-parse origin/main
git branch --list codex/redesign-lifecycle-integration
git ls-remote --heads origin codex/redesign-lifecycle-integration
```

要求当前 Phase 0/1 worktree 除本计划文件外没有未解释修改；若 `origin/main` 已前进，以执行时的新 SHA 为准，并把该 SHA 写入交付记录。

**Step 2: 从该 SHA 建立本地分支并推送**

```bash
git branch codex/redesign-lifecycle-integration origin/main
git push --set-upstream origin codex/redesign-lifecycle-integration
```

不得 checkout integration 到当前 Phase 0/1 worktree，不得从当前 HEAD 派生它。

**Step 3: 验证零差异和发布隔离**

```bash
test "$(git rev-parse origin/main)" = "$(git rev-parse origin/codex/redesign-lifecycle-integration)"
git rev-list --left-right --count origin/main...origin/codex/redesign-lifecycle-integration
gh run list --repo Drswith/quantex-cli --branch codex/redesign-lifecycle-integration --limit 20
```

期望差异为 `0 0`。新分支 push 不应产生 Release run；若产生，立即停止后续步骤并审计 workflow，而不是继续创建 PR。

---

## Task 2: 为交付策略创建独立 OpenSpec change

**Worktree / branch:**

```bash
git worktree add /Users/drs/.codex/worktrees/quantex-integration-bootstrap -b codex/support-integration-branch-delivery origin/main
cd /Users/drs/.codex/worktrees/quantex-integration-bootstrap
bun install --frozen-lockfile
```

**Create:**

- `openspec/changes/support-integration-branch-delivery/.openspec.yaml`
- `openspec/changes/support-integration-branch-delivery/proposal.md`
- `openspec/changes/support-integration-branch-delivery/design.md`
- `openspec/changes/support-integration-branch-delivery/tasks.md`
- `openspec/changes/support-integration-branch-delivery/specs/code-quality-tooling/spec.md`
- `openspec/changes/support-integration-branch-delivery/specs/project-memory/spec.md`
- `openspec/changes/support-integration-branch-delivery/specs/release-governance/spec.md`
- `openspec/changes/support-integration-branch-delivery/specs/release-workflow/spec.md`

**Step 1: 走 OpenSpec artifact gate**

```bash
bun run openspec:new -- support-integration-branch-delivery
bun run openspec:status -- --change support-integration-branch-delivery
bun run openspec:instructions -- proposal --change support-integration-branch-delivery
```

逐个 artifact 执行 `openspec:instructions`，按依赖顺序完成 proposal、design、delta specs、tasks；不得手写跳过 schema 指令。

**Step 2: 在 proposal/design 固化四个边界**

- integration 是临时、受保护、非发布聚合分支，不是第二条产品发布线。
- 仅允许一个 process-only bootstrap PR 先进入 `main`，用于让现有 main CI 可靠验证新的 workflow 和治理规则；任何生命周期重构代码仍不得进入 `main`。
- integration 初始化同步完成后创建临时 ruleset；后续所有变更只能经 PR。
- change 同时包含 setup 与 teardown，直到最终 integration 提升、分支/ruleset 清理、spec 同步和 archive closure 完成前保持 active。

**Step 3: 写四组可验证 requirement**

1. `code-quality-tooling`：目标为精确 integration 的 PR 必须获得与 main PR 相同的六个 required contexts；integration push 不增加触发。
2. `release-workflow`：integration 不得出现在 Release `workflow_run`、手动发布目标、Release PR 目标或 npm tag/channel 推导中。
3. `release-governance`：普通 PR 继续单提交；只有经过验证的同仓库 main-sync topology 和精确的 `integration -> main` 可以多提交；所有 PR 使用 rebase-first/squash-second 顺序，且同步/提升必须通过 expected-tree 与内容证据验收。
4. `project-memory`：umbrella change 可跨 milestone merge 保持 active；milestone merge 只报告 merge closure，最终 promotion 后才进入 spec sync/archive eligibility。

**Step 4: tasks 同时覆盖 setup、运行期和 teardown**

任务至少包含：workflow 测试/修改、PR policy 测试/修改、runbook 和 runtime 规则、bootstrap PR、integration ruleset、定期 main 同步、最终 promotion 后的 workflow 清理、ruleset/branch 清理、spec 同步、两个 active change 的 archive closure。

**Step 5: 验证 change，不改 redesign 的 74 项分母**

```bash
bun run openspec:status -- --change support-integration-branch-delivery
bun run openspec:validate
```

该 change 独立跟踪交付机制；`redesign-lifecycle-engine` 仍保持 `8/74`，直到对应实现任务真实完成才更新。

---

## Task 3: 用 TDD 增加 integration PR gate，同时证明不会发布

**Modify:**

- `test/workflow-classification.test.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/sandbox-tests.yml`

**Read-only assertions against:**

- `.github/workflows/release.yml`
- `.github/workflows/release-pr-automerge.yml`
- `.github/workflows/pr-governance.yml`

**Step 1: 先写失败测试**

在 `test/workflow-classification.test.ts` 增加只提取一个顶层 event block 的 helper，避免用全文件字符串匹配把 `pull_request` 与 `push` 混淆。断言：

- CI `pull_request` 包含精确 integration；CI `push` 不包含。
- Sandbox `pull_request` 包含精确 integration；Sandbox `push` 不包含。
- Release `workflow_run`、Release PR Automerge 全文都不包含 integration。
- PR Governance 的 `pull_request` block 没有 `branches` filter。

```bash
bun run test -- test/workflow-classification.test.ts
```

期望新增测试先失败，原因只能是 integration 尚未加入两个 PR trigger。

**Step 2: 做最小 YAML 修改**

仅在以下两个位置各增加一行：

```yaml
pull_request:
  branches:
    - main
    - beta
    - codex/redesign-lifecycle-integration
```

不得修改任意 `push.branches`、`.github/workflows/release.yml` 或 `.github/workflows/release-pr-automerge.yml`。

**Step 3: 运行 focused tests**

```bash
bun run test -- test/workflow-classification.test.ts
```

---

## Task 4: 用 TDD 为同步/最终提升建立窄治理例外

**Modify:**

- `scripts/pr-merge-commit-policy.ts`
- `test/pr-merge-commit-policy.test.ts`
- `.github/workflows/pr-governance.yml`

**Step 1: 扩展输入契约的失败测试**

为 `PullRequestMergeCommitPolicyInput` 设计以下环境上下文：

```ts
baseBranch?: string
headBranch?: string
sameRepository?: boolean
```

先增加测试并确认失败：

- 普通多提交 PR 仍被拒绝。
- 同仓库 `main -> codex/redesign-lifecycle-integration` 多提交被接受。
- 同仓库 `codex/redesign-lifecycle-integration -> main` 多提交被接受。
- fork 即使分支名相同也被拒绝。
- 近似分支名、临时 sync 分支或方向错误被拒绝。
- 两个例外仍拒绝 commit message 中的 `Co-authored-by` trailer。
- main 同步允许已在受保护 main 接受的 bot/agent author metadata；最终提升仍校验里程碑 commit author。

```bash
bun run test -- test/pr-merge-commit-policy.test.ts
```

**Step 2: 实现精确拓扑分类**

增加内部分类函数，只返回三种状态：`ordinary`、`main-sync`、`final-promotion`。判定必须满足 `sameRepository === true`，并满足以下精确条件之一：

- `main-sync`：base 是 integration，head 精确是 `main`。
- `final-promotion`：base 是 `main`，head 是 integration。

- `ordinary`：多提交、风险 author、prohibited trailer 规则不变。
- `main-sync`：允许多提交；由于这些 commit 已在受保护 main 接受，可跳过风险 author 二次检查；仍拒绝 prohibited trailer。
- `final-promotion`：允许多提交；仍检查所有风险 author 和 prohibited trailer。

输出成功消息应说明识别到的 topology，便于 Actions 日志审计。

**Step 3: 从 PR payload 传入可信上下文**

在 `.github/workflows/pr-governance.yml` 的 policy step 加入：

```yaml
PR_BASE_BRANCH: ${{ github.event.pull_request.base.ref }}
PR_HEAD_BRANCH: ${{ github.event.pull_request.head.ref }}
PR_SAME_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
```

脚本从环境读取这些值；不得从 PR body、title 或用户可控 label 推断例外。

**Step 4: 运行 focused tests**

```bash
bun run test -- test/pr-merge-commit-policy.test.ts test/workflow-classification.test.ts
```

---

## Task 5: 写入长期运行规则和审查模板

**Create:**

- `docs/runbooks/lifecycle-integration-delivery.md`

**Modify:**

- `docs/github-collaboration.md`
- `skills/quantex-agent-runtime/SKILL.md`
- `openspec/README.md`
- `.github/pull_request_template.md`
- `openspec/changes/support-integration-branch-delivery/tasks.md`

**Step 1: runbook 固化日常操作**

必须覆盖：

- 拓扑、分支命名、非发布边界和临时 ruleset。
- 新里程碑 worktree 创建、baseline 验证、单提交 PR 和两阶段 review。
- 用 integration/current tree 与 integration+main merge-tree expected tree 判定是否存在未同步内容；`rev-list`/commit log 只保留为图诊断，不作为同步触发器。
- main-sync 与 final-promotion 的 approved tips/expected tree 必须原子写入 `git rev-parse --git-path quantex/lifecycle-integration/...` 指向的 per-worktree ledger，跨新 shell 恢复并复验，禁止写入或提交 worktree 文件。
- 所有剩余 PR 均 rebase 优先、squash 其次，禁止 agent/automation 自动选择 merge commit；普通里程碑仍单提交，同步/最终提升保留精确多提交拓扑例外并使用内容级验收。
- 每个 PR 的 validation/OpenSpec/git/commit/remote/PR/merge/release/archive 分层报告。
- 最终 teardown 次序和失败回滚方式。

**Step 2: 修正“每次实现 PR merge 就 archive”的歧义**

runtime skill、OpenSpec README 和 PR template 明确：只有 change 的全部 task/requirement 已满足、delta spec 已同步时才进入 archive；umbrella milestone merge 只更新进度并保持 active。

**Step 3: 验证 project memory**

```bash
bun run memory:check
bun run openspec:validate
```

---

## Task 6: 验证并交付 process-only bootstrap PR 到 `main`

这是整个策略唯一一个在最终提升前进入 `main` 的 PR；它只能包含 OpenSpec 交付策略、workflow/governance、测试、runbook/runtime 文档，不得包含生命周期引擎实现。

**Step 1: 完整本地验证**

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
git diff --check
git status --short
```

**Step 2: spec review 和 code-quality review**

先用独立 reviewer 核对本计划、OpenSpec requirements 与 diff，再用另一 reviewer 检查实现质量。修复所有确认的 blocking/important findings，并重跑受影响 gate。

**Step 3: 单提交并推送**

```bash
git add .github docs openspec scripts skills test
git commit -m "ci: enable lifecycle integration PR gates"
git push --set-upstream origin codex/support-integration-branch-delivery
```

验证 commit 数为 1：

```bash
git rev-list --count origin/main..HEAD
```

**Step 4: 按模板创建 main PR**

PR title：`ci: enable lifecycle integration PR gates`

PR body 明确 `Release: not applicable - docs/process/test-only change`，列出 integration 不在发布触发中的测试证据，并说明两个 OpenSpec change 都保持 active。正文先保存到 `/tmp/quantex-integration-bootstrap-pr.md`，然后：

```bash
bun run pr:body:check -- --body-file /tmp/quantex-integration-bootstrap-pr.md --title "ci: enable lifecycle integration PR gates"
gh pr create --repo Drswith/quantex-cli --base main --head codex/support-integration-branch-delivery --title "ci: enable lifecycle integration PR gates" --body-file /tmp/quantex-integration-bootstrap-pr.md
```

**Step 5: 等待所有检查和 review 后合并**

bootstrap PR 使用 rebase 优先、squash 其次的一个 conventional commit。合并后验证 main CI 和 Release reconciliation；process-only `ci:` 变更不应生成 npm publish。若出现发布意图，停止并先修复隔离。

---

## Task 7: 快进初始化 integration，并建立临时保护

**Step 1: 在 ruleset 尚未启用时做唯一一次直接快进**

bootstrap 合并后：

```bash
git fetch origin --prune
git merge-base --is-ancestor origin/codex/redesign-lifecycle-integration origin/main
git push origin origin/main:refs/heads/codex/redesign-lifecycle-integration
git fetch origin --prune
test "$(git rev-parse origin/main)" = "$(git rev-parse origin/codex/redesign-lifecycle-integration)"
```

检查 integration 上已经包含更新后的 CI/Sandbox workflow。此后不再直接 push integration。

**Step 2: 从实时 `protect-main` 复制规则，而不是硬编码旧快照**

```bash
MAIN_RULESET_ID=$(gh api repos/Drswith/quantex-cli/rulesets --jq '.[] | select(.name == "protect-main") | .id')
INTEGRATION_RULESET_PAYLOAD=$(gh api repos/Drswith/quantex-cli/rulesets/$MAIN_RULESET_ID | jq -c '{name:"protect-lifecycle-integration",target:"branch",enforcement:"active",bypass_actors:.bypass_actors,conditions:{ref_name:{include:["refs/heads/codex/redesign-lifecycle-integration"],exclude:[]}},rules:.rules}')
gh api --method POST repos/Drswith/quantex-cli/rulesets --input - <<<"$INTEGRATION_RULESET_PAYLOAD"
```

创建前人工检查 payload 的 target、exact ref、required contexts、PR 和 non-fast-forward rules；不得复制与 main 无关的 branch selector。

**Step 3: 验证保护和发布隔离**

```bash
gh api repos/Drswith/quantex-cli/rulesets --jq '.[] | select(.name == "protect-lifecycle-integration")'
gh run list --repo Drswith/quantex-cli --branch codex/redesign-lifecycle-integration --limit 20
```

确认 integration ruleset 的 required contexts、PR requirement、allowed merge methods 和 non-fast-forward rule 与实时 main ruleset 一致。操作流程对所有 PR 显式选择 rebase，只有 rebase 不可用或不安全时才记录原因并选择 squash；不得自动选择 merge commit。确认 integration push 没有 Release run，记录 ruleset ID供最终 teardown 使用。

---

## Task 8: 将当前 Phase 0/1 历史安全归一为 integration PR

**Worktree:** 当前 `/Users/drs/.codex/worktrees/579c/quantex-cli`。

**Modify before PR:**

- `openspec/changes/redesign-lifecycle-engine/design.md`
- `openspec/changes/redesign-lifecycle-engine/tasks.md`（只保留真实完成的 8 项）
- 本计划文件

**Step 1: 保存现有 8-commit 历史，不做硬重置**

```bash
git fetch origin --prune
git status --short --branch
git branch -m codex/redesign-lifecycle-engine-task-history
git switch -c codex/redesign-lifecycle-engine origin/codex/redesign-lifecycle-integration
git merge --squash codex/redesign-lifecycle-engine-task-history
```

这使细粒度历史保留在本地 backup branch，同时新 PR 分支以最新 integration 为真实 base。解决冲突时以 integration 的 workflow/governance 为准，以历史分支的 Phase 0/1 实现为待应用 diff。

**Step 2: 把 integration 交付拓扑写入 redesign design**

补充：里程碑分支/PR、定期 main 同步、active-until-final、最终 promotion 和 archive 条件，并链接 `docs/runbooks/lifecycle-integration-delivery.md`。不得把 support change 的 workflow 细节复制成第二份 source of truth。

同时只改写 task 11.6 的文字、不改变编号或 checkbox：当其余 73 项均有证据、全部里程碑已进入 integration、且 post-promotion spec-sync/archive follow-up 已记录并验证时，11.6 可完成并使实施进度达到 74/74；actual spec sync/archive 仍必须等最终 promotion 合入 main 后执行。这样消除 74/74 进入门与 final-only archive 之间的循环依赖。

**Step 3: 审计 Phase 0/1 范围和 task 真值**

```bash
git diff --stat origin/codex/redesign-lifecycle-integration
git diff --check
bun run openspec:status -- --change redesign-lifecycle-engine
```

确认仍为 8/74；不得因为代码“接近完成”而勾选其余任务。

**Step 4: 全量验证和两阶段 review**

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
bun run build
```

先做 spec compliance review，再做 code-quality review；修复后重跑相关命令。

**Step 5: 创建一个 clean PR commit**

```bash
git add docs openspec src test
git commit -m "refactor(core): establish lifecycle engine foundation"
git rev-list --count origin/codex/redesign-lifecycle-integration..HEAD
git push --set-upstream origin codex/redesign-lifecycle-engine
```

commit 数必须为 1。PR base 必须是 `codex/redesign-lifecycle-integration`，不是 `main` 或 `beta`。

**Step 6: 校验 PR body 并等待 gate**

PR body 应列出完成的 8 个 task、剩余 `66/74`、兼容性边界、`Release: not applicable`、redesign 保持 active、archive/release pending。用 `pr:body:check` 后创建 PR。

等待 `classify`、`lint`、三平台 `test`、`sandbox-tests`、PR Governance 和独立代码审查全部通过，再以 rebase 优先、squash 其次的顺序合入 integration。合并后对比 PR 结果与 integration diff；确认无遗漏后才删除本地 `codex/redesign-lifecycle-engine-task-history`。

---

## Task 9: 按依赖顺序执行后续独立里程碑

每个里程碑开始前先确认前一 PR 已合入、integration checks 通过且 OpenSpec 仍 active。建议里程碑边界如下；若某一计划 review 发现跨度过大，只能进一步拆小，不能跨依赖合并：

1. **Compatibility and command-contract completion:** 1.1、1.3、1.4、2.4、3.1、3.2、3.4-3.7。
2. **Provider/catalog:** 4.1-4.14。
3. **Observation/read-only:** 5.1-5.7。
4. **State/mutation:** 6.1-6.8。
5. **Update/idempotency:** 7.1-7.6。
6. **Execution:** 8.1-8.4。
7. **Self-upgrade:** 9.1-9.5。
8. **Compatibility/cutover:** 10.1-10.6。
9. **Final validation readiness:** 11.1-11.6。为满足“74/74 后才创建最终 PR”与“最终合并后才 archive”两个约束，在 Phase 0/1 PR 中把 11.6 精确改写为：所有其他实现任务有证据、所有里程碑已合入 integration、且 post-promotion spec-sync/archive follow-up 已被记录并验证；完成它会使实施进度达到 74/74，但 change 仍保持 active。真正的 spec sync/archive 由 `support-integration-branch-delivery` 的 post-promotion closure tasks 约束。

**每个里程碑的固定循环：**

**Step 1: 检查 main 内容并按需执行 Task 10 的同步流程**

```bash
set -euo pipefail
git fetch origin --prune
integration_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
main_tip=$(git rev-parse origin/main)
integration_tree=$(git rev-parse "$integration_tip^{tree}")
expected_sync_tree=$(git merge-tree --write-tree "$integration_tip" "$main_tip")
test "$(git cat-file -t "$expected_sync_tree")" = tree
test "$expected_sync_tree" = "$integration_tree"
```

最后一个 `test` 成功表示内容已经同步，即使 `rev-list` 显示图分叉也不得重复创建 sync PR；失败才进入 Task 10。

**Step 2: 从最新 integration 建立全新 worktree/branch**

分支名采用 `codex/redesign-<milestone>`；worktree 采用 `/Users/drs/.codex/worktrees/quantex-redesign-<milestone>`。例如：

```bash
git worktree add /Users/drs/.codex/worktrees/quantex-redesign-provider-catalog -b codex/redesign-provider-catalog origin/codex/redesign-lifecycle-integration
```

**Step 3: 先写该里程碑独立实施计划**

路径：`docs/superpowers/plans/YYYY-MM-DD-lifecycle-<milestone>.md`。计划必须引用具体 OpenSpec task 编号、文件、测试、兼容性门和回滚条件；计划 review 通过后才改实现。

**Step 4: TDD 实施并精确更新 tasks**

每个行为先见到失败测试，再写最小实现。只有 task 文字的全部条件满足时才勾选；同一 PR 包含代码和对应 task 更新。

**Step 5: 本地 gate 与两阶段 review**

至少执行：

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
```

命中构建/发布/self-upgrade 范围时追加 `build`、`build:bin`、`package:check`、`release:artifacts`、`release:smoke`；命中真实生命周期时追加 container/sandbox。

**Step 6: 单提交 PR 到 integration**

在 push 前把里程碑归一为一个 conventional commit。按 PR template 写 body、运行 `pr:body:check`，base 精确设为 integration。所有 required checks 和两阶段 review 通过后先选择 rebase，只有 rebase 不可用或不安全时才记录原因并选择 squash；不得自动选择 merge commit，不归档 change，不发布 npm。

---

## Task 10: 定期通过 PR 同步最新 `main`

检查时机：每个里程碑开始前，以及 main 有新 release/修复后。是否创建同步 PR 只由内容树判定，不由 commit graph 判定。

**Step 1: 判定是否有未同步内容**

```bash
set -euo pipefail
git fetch origin --prune
integration_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
main_tip=$(git rev-parse origin/main)
integration_tree=$(git rev-parse "$integration_tip^{tree}")
expected_sync_tree=$(git merge-tree --write-tree "$integration_tip" "$main_tip")
test "$(git cat-file -t "$expected_sync_tree")" = tree
git rev-list --left-right --count "$main_tip...$integration_tip"
```

若 `expected_sync_tree` 等于 `integration_tree`，内容已经同步，不创建 PR。`rev-list` 和 commit log 只能解释图结构；rebase/squash 后即使它们列出不同 SHA，也不能据此认定 main 内容缺失。只有两个 tree 不等时才继续。

**Step 2: 创建同仓库同步 PR**

使用 head=`main`、base=`codex/redesign-lifecycle-integration`。PR title 使用 `chore(integration): sync latest main`，body 列出内容差异、仅作为诊断的图差异、冲突评估、非发布说明和 active OpenSpec 状态。

**Step 3: 等待 integration 的全部 gate**

该 PR 应被治理脚本识别为 `main-sync`，允许多提交，但 CI/Sandbox 必须完整运行。若精确 `main -> integration` PR 发生冲突，停止该次同步并创建一个窄 OpenSpec amendment 设计可验证的冲突解决拓扑；不得临时放宽分支名前缀、关闭 ruleset 或直接 push integration。

**Step 4: 使用 rebase-first / squash-second 合并并验证内容**

Review 批准精确 tips 后，把 approved tips 与 expected tree 原子写入当前 worktree 的 Git metadata：

```bash
set -euo pipefail
git fetch origin --prune
ledger_root=$(git rev-parse --git-path quantex/lifecycle-integration)
ledger="$ledger_root/main-sync.approved"
ledger_tmp="$ledger.tmp.$$"
mkdir -p "$ledger_root"
trap 'rm -f "$ledger_tmp"' EXIT
trap 'exit 1' HUP INT TERM
approved_base_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
approved_source_tip=$(git rev-parse origin/main)
approved_expected_tree=$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")
printf '%s\n%s\n%s\n' "$approved_base_tip" "$approved_source_tip" "$approved_expected_tree" >"$ledger_tmp"
mv "$ledger_tmp" "$ledger"
trap - EXIT HUP INT TERM
```

合并动作前必须在新 shell 中重新 fetch、从 ledger 恢复值，并验证 refs 没有漂移：

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/main-sync.approved)
test "$(wc -l <"$ledger" | tr -d '[:space:]')" = 3
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/codex/redesign-lifecycle-integration)" = "$approved_base_tip"
test "$(git rev-parse origin/main)" = "$approved_source_tip"
test "$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")" = "$approved_expected_tree"
: "${PR_NUMBER:?set PR_NUMBER to the approved main-sync pull request number}"
gh pr merge "$PR_NUMBER" --rebase --match-head-commit "$approved_source_tip"
```

任一 tip 漂移或 `--match-head-commit` 比较交换失败都必须停止，重新计算、重审、重跑 checks 并替换 ledger。rebase 因网络失败时重试 rebase；只有确认 rebase 不可用或不安全并记录原因后，才重跑完整 pre-merge block，并把最后一行替换为 `gh pr merge "$PR_NUMBER" --squash --match-head-commit "$approved_source_tip"`。agent/automation 不得使用 `--merge`。

合并后再开新 shell，从同一 ledger 恢复 approved values 并验证：

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/main-sync.approved)
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/codex/redesign-lifecycle-integration^{tree})" = "$approved_expected_tree"
git diff --name-status "$approved_source_tip"..origin/codex/redesign-lifecycle-integration
git diff "$approved_source_tip"..origin/codex/redesign-lifecycle-integration
```

剩余 diff 必须只有已接受的 lifecycle redesign 内容；不得声称 approved source 是 integration 的祖先或要求双亲提交。runtime ledger 不得加入 commit。integration push 不应触发 Release；验证后再创建下一里程碑 worktree。

---

## Task 11: 74/74 后执行最终提升、teardown、archive 与 release closure

**进入条件：**

- `redesign-lifecycle-engine` 按改写后的 11.6 显示 74/74，且全部任务有可复核证据；change 仍为 active，尚未同步 current specs 或 archive。
- 所有 milestone PR 已合入 integration，integration clean，最终一次 main sync 已完成。
- v1 兼容、构建、二进制、包分发、release artifacts、release smoke、container/sandbox 和平台矩阵全部通过。

**Step 1: 冻结 integration，但保留 PR gate**

完成最后一次 `main -> integration` 同步后冻结新里程碑。不要在最终 promotion 前删除 CI/Sandbox 的 integration PR target：最终 review 若发现问题，修复 PR 仍必须能在受保护 integration 上运行完整 gate。

**Step 2: 最终全量验证**

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
bun run build
bun run build:bin
bun run package:check
bun run release:artifacts
bun run release:smoke
bun run test:container
```

按可用凭据运行 `bun run test:sandbox`，并保留 CI/Sandbox 远端证据。

**Step 3: 创建 `integration -> main` 最终 PR**

治理脚本应识别 `final-promotion`，允许多提交但仍执行 author/trailer 检查。PR body 汇总 74 项证据、所有里程碑 PR、兼容性结果、发布意图和回滚方案。使用 main 的 required checks 和独立最终 code review。

**Step 4: 使用 rebase-first / squash-second 合入 main**

Review 批准精确 refs 后，将 final-promotion evidence 原子写入 Git metadata，而不是只留在 shell：

```bash
set -euo pipefail
git fetch origin --prune
ledger_root=$(git rev-parse --git-path quantex/lifecycle-integration)
ledger="$ledger_root/final-promotion.approved"
ledger_tmp="$ledger.tmp.$$"
mkdir -p "$ledger_root"
trap 'rm -f "$ledger_tmp"' EXIT
trap 'exit 1' HUP INT TERM
approved_base_tip=$(git rev-parse origin/main)
approved_source_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
approved_expected_tree=$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")
test "$(git rev-parse "$approved_source_tip^{tree}")" = "$approved_expected_tree"
printf '%s\n%s\n%s\n' "$approved_base_tip" "$approved_source_tip" "$approved_expected_tree" >"$ledger_tmp"
mv "$ledger_tmp" "$ledger"
trap - EXIT HUP INT TERM
```

合并动作前必须在新 shell 重新 fetch、恢复 ledger，并验证当前 main/integration tips 仍等于 approved values；任一漂移都停止并重新计算、重审、重跑 checks：

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/final-promotion.approved)
test "$(wc -l <"$ledger" | tr -d '[:space:]')" = 3
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/main)" = "$approved_base_tip"
test "$(git rev-parse origin/codex/redesign-lifecycle-integration)" = "$approved_source_tip"
test "$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")" = "$approved_expected_tree"
: "${PR_NUMBER:?set PR_NUMBER to the approved final-promotion pull request number}"
gh pr merge "$PR_NUMBER" --rebase --match-head-commit "$approved_source_tip"
```

任一 tip 漂移或 `--match-head-commit` 比较交换失败都停止。rebase 因网络失败时重试 rebase；只有确认 rebase 不可用或不安全并记录原因后，才重跑完整 pre-merge block，并把最后一行替换为 `gh pr merge "$PR_NUMBER" --squash --match-head-commit "$approved_source_tip"`。agent/automation 不得自动选择 merge commit。

合并后再用新 shell 从 ledger 恢复并 fail-fast 验证：

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/final-promotion.approved)
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/main^{tree})" = "$approved_expected_tree"
git diff --exit-code "$approved_source_tip" origin/main
```

不得以 integration tip 是 `main` 祖先或结果有两个 parent 作为完成条件，runtime ledger 也不得加入 commit。内容验收通过后再验证 main CI 和正式 Release workflow；只有 release 自动化完成且 npm/package/binary smoke 通过，才报告 release closure。

**Step 5: release 成功后删除临时远端状态**

确认已记录的 promotion result tree 与 approved integration 内容一致，审查 promotion 后任何仅存在于 `main` 的 release/recovery delta，并确认 main CI、正式 release 和 package/binary smoke 均闭环。内容证据和 recovery 条件通过后，先删除 `protect-lifecycle-integration` ruleset，再删除远端 integration 分支；不得用 source-tip 祖先检查替代内容证据。若内容审计失败或 release 尚未闭环，禁止删除并恢复到差异审计。

**Step 6: 显式 post-promotion closure PR**

最终 promotion 合并后，从最新 main 建立独立 archive branch：

- 删除 CI/Sandbox `pull_request.branches` 的 integration 条目并更新 workflow regression tests。
- 更新 runbook/runtime/project-memory 文档，记录 integration branch/ruleset 已移除。
- 将已接受 delta specs 同步到 `openspec/specs/`。
- archive `redesign-lifecycle-engine` 与 `support-integration-branch-delivery`。
- 运行 `openspec:archive-closure`、`openspec:validate`、`memory:check` 和基础四件套。
- 通过独立 process-only PR 合入 main；不得把 workflow cleanup 或 archive 偷塞进 promotion 前的里程碑。

closure PR 合并且两个 change 均归档后，最后清理已合并 milestone worktrees/本地 branches，并报告 archive closure。

---

## 每次交付必须报告的状态

- **Validation:** 执行命令、退出码和未执行原因。
- **OpenSpec:** 两个 active change 的当前进度；普通里程碑明确 `archive pending by design`。
- **Git:** base/head SHA、ahead/behind、working tree。
- **Commit:** 单提交里程碑或受信 topology 例外。
- **Remote / PR:** branch push、base、checks、review、merge method。
- **Release:** integration 阶段一律 `not applicable / no workflow triggered`，最终 main promotion 后才进入 release closure。
- **Archive:** 最终 promotion 前一律 pending；archive follow-up 合并后才 complete。

## 执行决策门

批准本计划即表示同意先提交一个严格 process-only 的 bootstrap PR 到 `main`。它是让 integration PR 在受保护前获得可靠 CI/Sandbox 与治理能力的最小前置条件，不包含 Phase 0/1 或任何生命周期实现。若不接受这一个例外，应暂停执行并重新设计 bootstrap；不得改为向未保护的 integration 直接提交 workflow。
