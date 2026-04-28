## Context

Quantex 仓库目前的代码质量工具链以 ESLint + `@antfu/eslint-config` 为核心：

- `eslint.config.js` 通过 `antfu({ type: 'lib', markdown: false })` 启用 lint + stylistic 规则，并在 `src/commands/**`、`src/cli.ts` 中关闭 `no-console`。
- `package.json` 暴露 `lint`、`lint:fix` 两个脚本，`lint-staged` 在 staged 文件上调用 `eslint --fix`。
- `simple-git-hooks` 把 pre-commit 设为 `bun install --frozen-lockfile && npx lint-staged`。
- `.vscode/extensions.json` 推荐 `dbaeumer.vscode-eslint`，`.vscode/settings.json` 关闭 Prettier、关闭 stylistic 规则在 IDE 提示，但允许 `source.fixAll.eslint`；旧配置没有把 Markdown 纳入自动格式化。
- `.github/workflows/ci.yml`、`release.yml`、`release-verify.yml` 在 lint 阶段执行 `bun run lint`；`AGENTS.md`、`docs/runbooks/*`、`README*.md`、`pull_request_template.md` 把 `bun run lint` 当作 validation trigger。

oxc 工具链（`oxlint` 1.62.0，`oxfmt` 0.47.0）现已稳定到可以承担小规模 CLI 仓库的 lint + format 责任：

- oxlint 1.x 提供与 ESLint 兼容的 720+ 规则，支持 type-aware lint，CLI 启动毫秒级。
- oxfmt 通过 100% Prettier JS/TS 一致性测试，内置 import 排序、`package.json` 字段排序，但仍处于 0.x 阶段，破坏性变更需要逐版本观察。
- 官方文档明确建议 “小型 / 中型项目 replace ESLint，大型 monorepo 渐进迁移”。Quantex 当前规模符合 replace 路径。

约束：

- 项目在 macOS / Linux / Windows 三平台 CI 上运行，oxc 工具链需提供匹配二进制。当前 npm 包通过 optionalDependencies 自动按平台拉取（与 esbuild 类似），bun 的 install hook 与 lockfile 已支持。
- AGENTS.md 必须保持 thin handbook，详细 lint/format 契约不能再次膨胀进 AGENTS.md，必须由新 spec 承担。
- OpenSpec 要求 spec 文件描述 “可观察的稳定行为契约”，所以 `code-quality-tooling` spec 写工具链入口、CI 行为，不写具体规则集。

## Goals / Non-Goals

**Goals:**

- 使用 oxlint 完全替代 ESLint，作为仓库唯一 linter；保持 `bun run lint` / `bun run lint:fix` 作为公共入口。
- 使用 oxfmt 作为仓库唯一 formatter，新增 `bun run format` / `bun run format:check`；CI 同时校验 lint 与 format。
- 保持旧的 Markdown 边界：Markdown 文档不进入默认自动格式化范围，避免工具切换带来大面积文档 reflow。
- 把 lint/format 工具链契约（必须使用 oxlint+oxfmt、必备 npm scripts、CI 与 pre-commit 行为、IDE 推荐扩展、配置文件位置）固化到 `code-quality-tooling` spec，避免再次回退到 ESLint 时缺少决策记录。
- 同步更新 lint-staged、pre-commit、CI workflow、`.vscode/*`、`AGENTS.md`、`docs/runbooks/*`、`README*.md`、`pull_request_template.md` 中的相关引用，使 `bun run lint`、`bun run format:check` 在所有入口语义一致。

**Non-Goals:**

- 不提供 ESLint <-> oxlint 双轨 lint；不保留任何 `eslint-plugin-oxlint` 兜底配置。
- 不引入 prettier 或 biome；本次只走 oxfmt。
- 不把 lint/format 规则细则写进 spec，只在配置文件里维护，避免 spec 变成 rule changelog。
- 不在 CI 上为 oxlint 增加额外 caching；可以等到性能不足时再优化。
- 不重写历史 archive 中的 `bun run lint` 引用，不改写历史 task 校验记录。

## Decisions

### Decision 1：完全替换而非共存

- 选择：移除 ESLint、`@antfu/eslint-config`、`eslint.config.js`，devDeps 中只保留 `oxlint`、`oxfmt`。
- 理由：仓库规模小（单 CLI 包，<200 源文件），oxlint 1.x 的规则覆盖率已足以承担基础正确性检查；`@antfu/eslint-config` 引入大量 transitive deps 且与 oxfmt 在 stylistic 上重叠，共存只会带来配置漂移。
- 备选：用 `eslint-plugin-oxlint` 关闭重叠规则、双轨运行。被否：徒增运行复杂度、无明显收益、官方在小型项目上不推荐。

### Decision 2：oxfmt 承担全部 stylistic 修复

- 选择：oxlint 配置中显式禁用所有 stylistic 类规则；统一由 oxfmt 写入格式。
- 理由：避免 lint --fix 与 format 互相覆盖；oxfmt 的输出已经与 Prettier 兼容，符合直觉。
- 备选：在 oxlint 中启用 `style` 规则集。被否：会与 oxfmt 产生竞争、CI 上需要手工排序两类工具的执行顺序。

### Decision 3：版本钉法

- 选择：`oxlint` 用 caret range（例如 `^1.62.0`），`oxfmt` 钉死小版本（例如 `0.47.0`）。
- 理由：oxlint 已进入 SemVer 1.x，可以放心 caret 升级；oxfmt 仍处于 0.x，每个 minor 都可能改 default formatting，钉死后需要在升级时主动 review。
- 备选：两者都 caret。被否：oxfmt 0.x 升级容易触发大面积 diff，钉死能让升级动作显式化。

### Decision 4：脚本与 Pre-commit 顺序

- 选择：`package.json` scripts：
  - `"lint": "oxlint"`
  - `"lint:fix": "oxlint --fix"`
  - `"format": "oxfmt"`
  - `"format:check": "oxfmt --check"`
- `lint-staged` 配置：对 JS/TS staged 文件先 `oxfmt --write`，再 `oxlint --fix`，确保 lint 看到的是最终格式；对 JSON/YAML/CSS/HTML 等非 lint 目标只运行 `oxfmt --write`。
- `simple-git-hooks` pre-commit 沿用 `bun install --frozen-lockfile && npx lint-staged`。
- 备选：在 pre-commit 直接调用 `oxlint && oxfmt`。被否：lint-staged 仍能限制只对 staged 文件操作，避免无关 diff。

### Decision 5：CI 集成

- 选择：在 `ci.yml`、`release.yml`、`release-verify.yml` 的 lint 步骤之后追加一行 `bun run format:check`，并保留 `bun run typecheck`。
- 理由：format 不通过应当像 lint 不通过一样 block 合并；与 archive workflow 的描述保持一致（`bun run lint` 仍是入口名）。
- 备选：把 lint+format 合成单条 script。被否：分开更易在 CI 日志中定位故障；与 oxlint/oxfmt 各自独立的失败语义匹配。

### Decision 6：IDE 推荐扩展

- 选择：`.vscode/extensions.json` 推荐 `oxc.oxc-vscode`；`.vscode/settings.json` 改为：
  - 关闭 `eslint.enable`（移除条目）；
  - 让 `editor.defaultFormatter` 为 oxc/oxfmt 扩展，开启 `editor.formatOnSave`（仅对支持的代码/配置语言，不包含 Markdown）；
  - 允许 `source.fixAll.oxc` codeAction。
- 备选：保留 ESLint 扩展不修改 IDE 设置。被否：会让本地体验与命令行行为分裂。

### Decision 7：spec 颗粒度

- 选择：新增独立 capability `code-quality-tooling`，在 spec 中只描述工具链入口与 CI / pre-commit / IDE 行为契约。
- 备选：把 lint/format 契约塞进 `project-memory`。被否：`project-memory` 只负责 AGENTS.md 内容与 OpenSpec 流程，不应承担工具选择。

### Decision 8：配置文件位置

- 选择：`.oxlintrc.json`、`.oxfmtrc.json`（或工具支持的 `oxfmt.toml`）放在仓库根。
- 理由：与 oxc 官方推荐保持一致，便于 IDE 自动发现。
- 备选：放进 `tool/oxc/` 子目录。被否：会让 IDE 与 CI 都需要传 `--config` 路径，引入隐性配置。

## Risks / Trade-offs

- **oxfmt 0.x 风险** → 钉死小版本；升级走显式 PR + 手工 review 的方式；在 design 中要求每次升级前跑 `bun run format:check` + 完整 git diff 校对，必要时回退到 0.47.0。
- **oxlint 规则差异** → ESLint 中由 `@antfu` 设置的部分规则（例如 `style/*`、`*-quotes`）将由 oxfmt 接管；首次切换可能产生大面积 diff，必须在迁移 PR 中作为单独提交呈现，便于 reviewer 区分逻辑变更。
- **type-aware lint 启用代价** → oxlint type-aware 需要 tsconfig 与 tsgo，启动可能变慢；本次仅启用默认 correctness 规则，不开启 type-aware，待后续 PR 评估收益再开。
- **Bun + optional deps** → `oxlint` / `oxfmt` 通过 optionalDependencies 分发平台二进制；若 CI 缓存命中错误平台二进制将导致失败。`bun.lock` 重新生成后必须在 CI matrix 上跑通。
- **lint-staged 顺序失效** → lint-staged 默认并行执行不同 glob，可能导致 oxfmt 与 oxlint 相互踩踏；按 lint-staged v16 的 array 语法让 JS/TS 文件依次执行 `["oxfmt --write", "oxlint --fix"]`，并把其他格式化目标拆到只运行 `oxfmt --write` 的独立 glob，排除 Markdown，避免产生大面积文档 reflow 或把非 JS/TS 文件误传给 oxlint。
- **VS Code 用户体验** → 官方扩展（`oxc.oxc-vscode`）在 IDE Marketplace 与 OpenVSX 都可获取；若用户原本依赖 vscode-eslint，需要在文档中提示卸载或停用。
- **archive 模板** → `.github/workflows/openspec-archive.yml` 中的字符串 `bun run lint` 是模板说明文字，无需修改；本次不动其内容，避免 archive 模板与 spec 脱钩。

## Migration Plan

1. 更新 devDependencies：移除 `eslint`、`@antfu/eslint-config`，新增 `oxlint`、`oxfmt`，`bun install` 重写 `bun.lock`。
2. 删除 `eslint.config.js`，新增 `.oxlintrc.json`、`.oxfmtrc.json`，落实 Decision 2 / 4。
3. 调整 `package.json` scripts、`lint-staged` 配置。
4. 重写 `.vscode/extensions.json`、`.vscode/settings.json`（落实 Decision 6）。
5. 更新 `ci.yml`、`release.yml`、`release-verify.yml` lint 段（落实 Decision 5）。
6. 更新 `AGENTS.md` Validation 章节、`docs/runbooks/releasing-quantex.md`、`docs/runbooks/release-and-self-upgrade-debugging.md`、`README.md`、`README.en.md`、`.github/pull_request_template.md` 中的本地校验段落。
7. 跑 `bun run lint`、`bun run format`、`bun run format:check`、`bun run typecheck`、`bun run test`、`bun run openspec:validate`、`bun run memory:check`，按 closure gate 顺序确认。
8. 提交单独的 “format reflow” commit（仅 oxfmt 输出），与逻辑改动分离。
9. PR 描述中显式列出工具链版本、回滚步骤（恢复 ESLint 配置 + 旧脚本）和与 archive 同步的 follow-up。

## Open Questions

- oxfmt 是否需要专门的 `.oxfmtignore`？默认会读取 `.gitignore`，但仓库内 `dist/` 仍受 `.gitignore` 控制，应足够。如确需额外排除（例如生成的 `src/generated/build-meta.ts`），在实现阶段补充。
- 是否在本次同时把 `bun run format:check` 加进 `bun run memory:check` / `pull_request_template.md` 的 validation checklist？计划：加进 PR template；`memory:check` 维持现状（其职责是检查 OpenSpec 文档结构，不承担 lint）。
