# TODO

## Current Status

已完成的主要能力：

- Agent 安装、卸载、查询、快捷启动
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

## Next Priorities

### Product / UX

- [ ] 为 `update` / `upgrade` 增加更清晰的失败分类输出
- [ ] 为 `doctor` 增加更多可操作的环境修复建议
- [ ] 为 agent 更新结果补充更清晰的 summary 输出

### Agent Catalog

- [ ] 继续补全更多 agent 的 `selfUpdate`
- [ ] 继续补全更多 agent 的 `versionProbe`
- [ ] 复核现有 agent 安装脚本、包名、官网地址是否仍然准确

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

### Docs

- [x] README 与使用说明同步到当前实现
- [x] `AGENTS.md` 同步到当前目录结构和核心类型
- [ ] 补一份面向贡献者的 release / self-upgrade 调试说明

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
