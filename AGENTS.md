# AGENTS.md

## Mission

- Quantex 是 `human-friendly + agent-friendly` 的 `agent lifecycle CLI`
- 主线聚焦 agent 的安装、检查、确保可用、更新、卸载、能力发现与稳定执行契约
- 不把主线推进成 workflow orchestration platform
- `batch / stdin pipe / apply / daemon / MCP server` 等能力默认视为扩展议题，不作为主线目标

## Agent Quickstart

1. 先分类当前请求，判断是否触发 OpenSpec intake gate。
2. 只要改动 observable behavior、durable workflow、project memory 或 product-facing docs，就先选择或创建 OpenSpec change。
3. 用 `bun run openspec:status -- --change <id>` 和 `bun run openspec:instructions -- <artifact> --change <id>` 确认下一步。
4. 先做最小闭环实现，再同步更新相关 spec、ADR、session、issue 或 docs。
5. 改完后至少跑 `bun run lint`、`bun run format:check` 和 `bun run typecheck`；如果动了行为，也跑 `bun run test`。
6. 结束前报告 validation、OpenSpec、git、commit、push、PR、release、archive closure 状态。

## Must

- 实现前先过 intake gate；用户说“直接开始”或“做到闭环”为授权推进，不是授权跳过流程。
- 非平凡行为或 durable-process 改动必须先有 OpenSpec change，再做文件编辑。
- GitHub Discussion 不是长期依据；要把结论提升为 issue、OpenSpec、ADR、runbook 或 session summary。
- `AGENTS.md` 必须保持薄且高信号：只内联立即影响执行的规则，把易漂移细节指向 source of truth。
- 修改项目记忆、协作流程、发布流程、行为契约时，同步更新对应 repo-native artifacts。

## Must Not

- 不要把 Quantex 主线扩展成 workflow orchestration platform。
- 不要因为用户催促、测试通过或任务勾选完成，就跳过 commit / push / PR / archive closure 检查。
- 不要在 `AGENTS.md` 里复制大段目录树、类型定义、完整命令表或其他易漂移内容。
- 不要新建 ad hoc root-level markdown；先把内容归类到 `openspec/` 或 `docs/`。

## Validation

基础命令：

```bash
bun install
bun run lint
bun run format
bun run format:check
bun run typecheck
bun run test
bun run openspec:list
bun run openspec:status -- --change <change-id>
bun run openspec:validate
bun run memory:check
bun run build
bun run build:bin
bun run release:artifacts
```

触发规则：

- 改了任意文件：跑 `bun run lint`、`bun run format:check` 和 `bun run typecheck`；本地修复用 `bun run lint:fix` 与 `bun run format`
- 改了 CLI 行为、结构化输出、契约或集成逻辑：再跑 `bun run test`
- 改了 OpenSpec / docs / project memory 流程：跑 `bun run openspec:validate`，必要时跑 `bun run memory:check`
- 改了构建、发布、自升级或 release artifacts：补跑 `bun run build`、`bun run build:bin`、`bun run release:artifacts`
- lint 由 `oxlint` 提供，format 由 `oxfmt` 提供（配置见 `.oxlintrc.json` / `.oxfmtrc.json`）；不要再引入 `eslint`、`@antfu/eslint-config` 或 `prettier`

## Work Intake Gate

实现、续做、收尾、直接执行类请求都必须先分类。

如果改动涉及以下任一项，先创建或选择 OpenSpec change：

- observable CLI behavior
- stable structured output、schema、command catalog 或 machine-readable contract
- agent registry/catalog fields、install methods、update strategy 或 version probing
- configuration、state、cache、release、publishing 或 upgrade behavior
- architecture boundaries，如 `core`、`surface`、services、package-manager、self-upgrade
- project memory policy、durable workflow、OPSX/OpenSpec rules、ADR/runbook process、GitHub collaboration flow
- product-facing documentation that changes how users understand installation、commands、release 或 agent-facing usage

只有这些情况可以不走 OpenSpec：

- typo 或 formatting-only edits
- 不改变产品/流程含义的小型 wording cleanup
- 没有行为、契约或 durable-process 影响的机械维护
- 不重定义预期行为的 test-only cleanup

如果不走 OpenSpec，要先简短说明分类；拿不准时，优先走 OpenSpec。

## Delivery Closure Gate

任何改过文件的回合，在宣称完成前都要检查并报告：

- validation state
- OpenSpec state
- git state
- commit state
- remote state
- PR state
- release state

闭环层级：

- local implementation：文件已改且本地验证通过
- repository delivery：已提交且 working tree clean
- PR delivery：分支已推送且 PR 已创建
- merge delivery：PR 已合入目标分支
- OpenSpec archive closure：spec delta 已同步且 change 已归档
- release closure：需要发布时，发布自动化已完成

如果用户要求“继续”或“闭环”，就推进到下一个可达层级，而不是停在本地实现。若受保护分支、必需检查、评审、发布流程或 archive follow-up 阻塞，要明确剩余 owner。

## File-Scoped Red Lines

- `AGENTS.md`：只保留 mission、gates、validation、red lines 和 trigger-based pointers；不要重新长成 README、架构转储或命令镜像。
- `openspec/specs/`：写当前生效的行为/流程契约，不写临时实现笔记。
- `openspec/changes/`：存活跃 change；只有合并后且 spec 已同步时才归档到 `openspec/changes/archive/`。
- `docs/adr/`：只记录会持续影响未来决策的长期选择。
- `docs/sessions/`：记录讨论摘要；稳定结论继续上升到 ADR、OpenSpec、runbook 或 issue。
- `src/generated/build-meta.ts`、`dist/`、release artifacts：视为生成物或发布产物，除非任务明确需要，不手工当作 source of truth 改写。

## Trigger-Based Pointers

- 改 agent catalog、install metadata、version probe、update strategy：
  `src/agents/types.ts`、`src/agents/definitions/`、`src/agent-update/`、`openspec/specs/agent-catalog/spec.md`、`openspec/specs/agent-update/spec.md`
- 改 CLI surface、稳定命令目录或 schema：
  `src/commands/`、`src/cli.ts`、`src/index.ts`、`quantex commands --json`、`quantex schema --json`
- 改 config、state、self-upgrade、release artifacts：
  `src/config/`、`src/state/`、`src/self/`、`src/release-artifacts/`、`openspec/specs/self-upgrade/spec.md`、`docs/releases.md`
- 改 durable workflow、project memory、GitHub collaboration：
  `openspec/README.md`、`openspec/config.yaml`、`docs/README.md`、`docs/github-collaboration.md`、`openspec/specs/project-memory/spec.md`
- 改产品介绍、安装方式、用户理解：
  `README.md`、`README.en.md`、`openspec/specs/product-readme/spec.md`
- 改 lint / format 工具链、IDE 推荐扩展、pre-commit 钩子：
  `.oxlintrc.json`、`.oxfmtrc.json`、`package.json` (`scripts`、`lint-staged`、`simple-git-hooks`)、`.vscode/extensions.json`、`.vscode/settings.json`、`openspec/specs/code-quality-tooling/spec.md`
- 需要真实类型或默认值时，不要复制片段；直接看源码：
  `src/agents/types.ts`、`src/self/types.ts`、`src/config/default.ts`

## Notes

- Windows 平台需特别处理 PowerShell 安装脚本和 delayed binary replacement
- `quantex <agent>` 快捷启动时，未安装的 agent 应提示自动安装
- `quantex update --all` 优先使用已记录的实际安装来源，而不是只看 agent 定义中的候选安装方式
- `Bun.spawn` 使用 `stdio: 'inherit'` 透传 agent 进程 IO
- self binary upgrade 已包含 checksum、lock、verify、`.bak` rollback 与 Windows 延迟替换
- 全局 dual-mode surface 当前还包括 `--yes`、`--quiet`、`--color`、`--log-level`、`--dry-run`、`--refresh`、`--no-cache`
- 结构化 `meta` 当前可附带 `fetchedAt`、`staleAfter`、`source`
