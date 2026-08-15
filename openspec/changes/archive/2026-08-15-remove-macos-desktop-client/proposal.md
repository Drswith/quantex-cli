## Why

Quantex 的核心产品边界是轻量的 agent lifecycle CLI；已合入的 macOS 桌面客户端引入了第二套 UI、构建发布链路和仅供桌面端使用的 CLI 扩展。现在移除这条产品线，可以恢复 CLI 的单一交付面，降低依赖、维护和发布复杂度。

本请求属于 observable behavior 和产品边界变更，因此按 OpenSpec intake gate 建立本 change 后实施。

## What Changes

- **BREAKING** 移除 macOS Tauri/React 桌面客户端及其界面、原生宿主、测试、构建和开发入口。
- **BREAKING** 移除仅由桌面客户端消费的 managed-only 批量更新发现模式和 `--managed` 结构化契约。
- 移除桌面 sidecar 准备、桌面 workspace、桌面专用依赖、CI/macOS 打包检查和相关 npm workspace 放行规则。
- 恢复桌面特性合入前的 `agent-update`、`cli-contract-registry` 和 `package-distribution` 契约。
- 保留 CLI 现有的单 agent 更新、普通 `update --all`、安装、检查、确保、卸载、执行、自升级和结构化输出能力。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `macos-desktop-client`: 移除整个 macOS 桌面客户端能力及其所有行为要求。
- `agent-update`: 移除仅供桌面端使用的 managed-only 批量发现要求，保留普通批量更新。
- `cli-contract-registry`: 移除 `update --managed` 选项和 `data.scope: "managed"` 契约。
- `package-distribution`: 移除桌面 sidecar 打包和桌面私有 workspace 的发布契约。

## Impact

- 删除 `apps/desktop` 及其 Tauri/Rust、React、mock 和测试文件。
- 恢复根 `package.json`、`bun.lock`、TypeScript/lint/format 配置、CI workflow、release/package 校验和 sidecar 脚本。
- 恢复 `src/command-contract`、`src/commands/update.ts`、生命周期更新服务及其测试/fixture。
- 清理桌面 OpenSpec active/archive 产物；本 change 本身保留为合并后 archive closure 的依据。
- 不回退 v1.10.0 或其他后续 release commit；下一次版本由正常 release automation 记录此 breaking removal。
