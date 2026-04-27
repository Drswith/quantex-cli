# TODO

> Migration status: frozen snapshot.
> New work should be added to GitHub issues or OpenSpec changes, not to this file. The old task history now lives in [OpenSpec archives](/Users/drs/workspaces/personal/quantex-cli/openspec/changes/archive/qtx-task-history.md).

## Current Status

已完成的主要能力：

- Agent lifecycle CLI 主线已经收口为 `human-friendly + agent-friendly`
- Agent 安装、卸载、查询、快捷启动
- dual-mode surface：`human / json / ndjson`
- 全局 agent-friendly 契约：
  - `--json`
  - `--output`
  - `--non-interactive`
  - `--yes`
  - `--quiet`
  - `--color`
  - `--log-level`
  - `--dry-run`
  - `--refresh`
  - `--no-cache`
  - `--run-id`
  - `--idempotency-key`
  - `--timeout`
- 非 TTY 自动切换到 agent-friendly 默认行为
- agent-oriented 命令：
  - `inspect`
  - `ensure`
  - `resolve`
  - `exec`
  - `capabilities`
  - `commands`
  - `schema`
- 稳定输出契约：
  - result envelope
  - `schemaVersion`
  - error code / exit code
  - `stdout / stderr` 分流
- reliability：
  - timeout / cancel
  - idempotency replay
  - state / lifecycle 资源锁
  - 缓存新鲜度 `fetchedAt / staleAfter / source`
- `update <agent>` 与 `update --all`
- agent 更新策略层：`managed / self-update / manual-hint`
- Quantex CLI 自升级：
  - bun / npm / binary 三种来源识别
  - typed errors
  - checksum 校验
  - upgrade lock
  - post-upgrade verify
  - `.bak` 最小回滚
  - channel / `--check`
- release artifacts：
  - `SHA256SUMS.txt`
  - `manifest.json`
  - artifact verification
- CI 跨平台测试
- Quantex agent skill：
  - 主 skill / UI metadata
  - command / automation / output contract / troubleshooting references
  - smoke-check 脚本

## Next Priorities

### Product / UX

- [ ] 为 `update` / `upgrade` 增加更清晰的失败分类输出
- [ ] 为 `doctor` 增加更多可操作的环境修复建议
- [ ] 为 agent 更新结果补充更清晰的 summary 输出
- [ ] 评估是否要为 human mode 增加更清晰的 lifecycle summary，不影响结构化契约

### Agent Catalog

- [ ] 继续补全更多 agent 的 `selfUpdate`
- [ ] 继续补全更多 agent 的 `versionProbe`
- [ ] 复核现有 agent 安装脚本、包名、官网地址是否仍然准确
- [ ] 评估是否需要补充更多主流 agent 定义

### Self Upgrade

- [ ] 评估是否需要 release notes / breaking changes 提示
- [ ] 评估是否需要更强的 binary 签名校验，而不只依赖 checksum
- [ ] 评估是否需要更显式的 rollback / repair 命令

### Release / CI

- [x] release checksums 生成脚本化
- [x] release manifest 生成脚本化
- [x] release artifacts 一致性校验
- [ ] 为 release workflow 增加更明确的 smoke test
- [ ] 为二进制产物增加安装后基本运行验证
- [ ] 评估是否要把 `skills/quantex-cli/scripts/smoke-check.sh` 接进 CI 的文档 / skill 侧校验

### Docs

- [x] README 与使用说明同步到当前实现
- [x] `AGENTS.md` 同步到当前目录结构和核心类型
- [x] Quantex agent skill 初版完成
- [ ] 补一份面向贡献者的 release / self-upgrade 调试说明
- [ ] 评估是否需要补一份 skill 安装 / 分发说明

### Scope Discipline

- [ ] 继续保持 Quantex 主线聚焦 lifecycle CLI，不把扩展能力重新拉回主线
- [ ] 如需推进 `batch / stdin pipe / apply / daemon / MCP surface`，单独开新 issue 或新 epic

## Useful Commands

```bash
bun install
bun run lint
bun run lint:fix
bun run typecheck
bun run test
bun run build
bun run build:bin
bun run release:artifacts
```
