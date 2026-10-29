# AGENTS.md

## Quantex 是什么

- `quantex` / `qtx` 是给人和 agent 共用的 agent 生命周期 CLI：安装、检查、确保可用、更新、卸载、启动各类 coding agent CLI。
- 不做 workflow 编排平台。batch / stdin pipe / daemon / MCP server 等不是主线目标。
- 这条线是 Rust 从零实现，替代 TypeScript 版 v1.13.x。`2.0.0-beta.1` 与 v1.13.6 对齐；从 `2.0.0-beta.2` 起目标是精简轻量，不再逐项对齐 v1。背景和决定见 `docs/design/rust-rewrite.md`。

## 契约优先

- 对外接口全部记录在 `contract/`，说明见 `contract/README.md`。优先级：契约测试 > `contract/` 下的数据文件 > `contract/behavior/` 里的行为说明。
- 改了任何外部可观察的行为（命令、参数、JSON 字段、错误码、exit code、`~/.quantex` 文件格式、release 资产名），同一个 PR 里必须同时更新 `contract/` 和 `tests/contract/`，并写进 `CHANGELOG.md`。
- human 输出不算契约，可以自由调整排版，但含义要和 JSON 一致。
- 想确认 v1 的行为，用 `git show v1.13.6:<path>` 读旧实现，或跑 v1.13.6 的发布二进制。不要照搬它的代码结构。

## 目录

- `crates/quantex/`：二进制和它的库代码
- `tests/contract/`：黑盒契约测试，通过 `QUANTEX_BIN` 指定被测二进制
- `contract/`：命令注册表、schema、错误码、agent 目录、测试数据、行为说明，构建时内嵌进二进制
- `skills/quantex-cli/`：给用户安装的产品 skill。路径和名字不能变，用户通过 `npx skills add Drswith/quantex-cli --skill quantex-cli` 安装
- `install.sh`、`install.ps1`：独立二进制的安装脚本
- `docs/design/`：设计记录

## 验证

改了代码至少跑：

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`cargo test --workspace` 会先构建 `quantex`，再对它跑契约测试。要拿 v1.13.6 基准对照时，把 `QUANTEX_BIN` 指向那个二进制，再单独跑 `cargo test -p quantex-contract-tests`。

## 红线

- 未经维护者明确同意，不改命令名、别名、参数、JSON 字段名和类型、错误码、exit code。
- `~/.quantex` 下的文件格式和锁协议必须能和 v1.13.6 互相读写。
- release 资产名、`SHA256SUMS.txt` 和 `manifest.json` 格式不能变，发布必须从 `Drswith/quantex-cli` 出。老版本的二进制靠它们升级。
- JSON / NDJSON 模式下 stdout 只能输出协议内容，日志和提示一律走 stderr。
- Windows 是一等平台：路径、`.cmd` 包装、PATHEXT、Ctrl-C、替换正在运行的二进制都要考虑到。
- 不要新建根目录下的零散 markdown，设计记录放 `docs/design/`。

## 交付

- 从这条线拉分支，提 PR，CI 全绿再合并。
- commit 消息用 Conventional Commits（`feat:`、`fix:`、`chore:` 等），关联 Linear issue 时写 `Refs DRS-123`。
- 收尾时说明：跑了哪些验证、结果如何、改了哪些契约文件、提交和推送状态。
