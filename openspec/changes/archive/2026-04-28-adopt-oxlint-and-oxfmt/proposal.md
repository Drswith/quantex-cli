## Why

Quantex 当前的代码质量工具链使用 ESLint + `@antfu/eslint-config` 同时承担 lint 与 stylistic 修复。oxlint / oxfmt 已经成熟到足以在小型 CLI 项目中替代 ESLint：oxlint 启动只需毫秒级、覆盖 720+ 规则且支持 type-aware 检查；oxfmt 通过 100% Prettier JS/TS 一致性测试，并内置 import / `package.json` 排序。统一切换到 oxc 工具链可以显著缩短本地与 CI 上 `bun run lint` 的耗时，简化项目内置的工具依赖（移除 `@antfu/eslint-config` 这条庞大的 transitive 依赖链），同时把原本由 ESLint stylistic 规则承担的格式化职责迁移到专门的 formatter 上，避免 lint 与 fmt 在同一份配置里互相耦合。

工作分类：本次属于 durable development workflow 变更（影响 `bun run lint`、lint-staged、pre-commit、CI lint job、AGENTS.md validation triggers、IDE 推荐扩展、docs/runbooks 中关于本地校验的描述），按照 work intake gate 必须以 OpenSpec change 形式记录契约后再实施。

## What Changes

- **BREAKING (developer workflow)**：移除 ESLint、`@antfu/eslint-config`、`eslint.config.js`、`eslint-plugin-*` 等 ESLint 相关依赖与配置；项目不再支持基于 ESLint 的 lint/format。
- 引入 `oxlint`（dev dependency）作为唯一 linter，并在仓库根新增 `.oxlintrc.json`，沿用 `correctness` 默认严苛度并按需启用项目特有规则（例如允许 `src/commands/**` 与 `src/cli.ts` 中的 `console`）。
- 引入 `oxfmt`（dev dependency）作为唯一 formatter，新增 `.oxfmtrc.json`（或 `oxfmt.toml`，按工具支持选择）以记录最少的差异化配置。
- 重写 `package.json` scripts：
  - `lint` -> `oxlint`
  - `lint:fix` -> `oxlint --fix`
  - 新增 `format` -> `oxfmt`
  - 新增 `format:check` -> `oxfmt --check`
- 更新 `lint-staged`：对受支持的 staged 文件先跑 `oxfmt --write`，再跑 `oxlint --fix`，并通过 simple-git-hooks pre-commit 触发。
- 更新 `.vscode/extensions.json` 与 `.vscode/settings.json`：推荐 `oxc.oxc-vscode`，移除 `dbaeumer.vscode-eslint`；停用 ESLint 相关 codeActionsOnSave / rule customizations，改为 oxc/oxfmt 的等价配置。
- 更新 GitHub Actions：
  - `ci.yml` lint job 在 `bun run lint` 之外追加 `bun run format:check`。
  - `release.yml`、`release-verify.yml` 中的 lint 步骤同步增加 `bun run format:check`。
  - `openspec-archive.yml` 模板说明保持兼容（`bun run lint` 仍是入口名称）。
- 更新项目内文档：
  - `AGENTS.md` Validation 章节明确 `bun run format:check` 与 `bun run lint` 的触发条件。
  - `docs/runbooks/releasing-quantex.md`、`docs/runbooks/release-and-self-upgrade-debugging.md` 中本地校验段落补上 `bun run format:check`。
  - `README.md`、`README.en.md` 的 Local validation 提示同步更新。
- 新增 capability spec `code-quality-tooling`，把 lint/format 工具链的来源、命令入口、CI 与 pre-commit 行为契约固化下来，避免再次回到 ESLint 时缺少决策记录。

## Capabilities

### New Capabilities

- `code-quality-tooling`: 定义 Quantex 仓库 lint 与 format 工具链的稳定契约（必须使用 oxlint + oxfmt、统一的 npm scripts 入口、CI 与 pre-commit 行为、IDE 推荐扩展），覆盖以前散落在 ESLint 配置、AGENTS.md、CI workflow、runbook 中的隐性约定。

### Modified Capabilities

- 无：`project-memory` 仍然只规定 AGENTS.md 必须保留 validation triggers，不绑定具体工具；本次只新增工具契约 spec，不改 project-memory 既有 requirement。

## Impact

- **代码与配置**：删除 `eslint.config.js`，新增 `.oxlintrc.json`、`.oxfmtrc.json`（或同等配置文件）。
- **依赖**：`devDependencies` 移除 `eslint`、`@antfu/eslint-config`，新增 `oxlint`、`oxfmt`；`bun.lock` 同步重写。
- **CI / 自动化**：`.github/workflows/ci.yml`、`release.yml`、`release-verify.yml` lint 步骤、`lint-staged` + `simple-git-hooks` pre-commit 调用链。
- **IDE 体验**：`.vscode/extensions.json`、`.vscode/settings.json`；推荐 oxc 官方扩展。
- **项目记忆**：`AGENTS.md` Validation 段落、`docs/runbooks/*` 中的本地校验段、`README.md` / `README.en.md` Local validation 段落。
- **OpenSpec**：新增 `openspec/specs/code-quality-tooling/spec.md`；本 change 的 spec delta 在 `openspec/changes/adopt-oxlint-and-oxfmt/specs/code-quality-tooling/spec.md` 中。
- **风险**：oxfmt 当前主版本 0.x（撰写时为 0.47.0），需要在 design 中说明回退策略与版本钉法；oxlint 已进入 1.x，可按 caret range 升级，但仍需在 CI 上钉死大版本。
