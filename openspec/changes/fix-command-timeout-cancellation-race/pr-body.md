## Summary

修复 `executeCommandWithRuntime` 在配置 `--timeout` 或进程信号先触发时的竞态：`Promise.race` 已返回 `TIMEOUT` 或 `CANCELLED` 后，底层 `run()` 仍可能稍后完成并执行 `finalizeSuccessfulRun`，从而错误地持久化幂等成功记录并触发被动升级提示等副作用。通过在上下文已取消时跳过收尾、以及在超时路径的 `run` 链上在 `finally` 中重新标记取消，避免迟到的成功结算污染幂等与状态。

## Linked Artifacts

- Issue:
- ADR:
- OpenSpec: `openspec/changes/fix-command-timeout-cancellation-race`
- Discussion:

## Validation

- [x] `bun run memory:check`
- [x] `bun run lint`
- [x] `bun run format:check`
- [x] `bun run typecheck`
- [x] `bun run test` (if behavior changed)
- [ ] Not run, explained below

## Release Intent

- Release: not applicable - docs/process/test-only change
- Release: patch - bug fix
- Release: minor - user-facing feature
- Release: major - breaking change

## Docs Updated

- [ ] Not needed
- [ ] `docs/...`
- [x] `openspec/...`
- [ ] Follow-up issue or OpenSpec change created instead

## Scope Check

- [x] I did not add a new ad hoc root-level Markdown file.
- [x] I updated the relevant issue, ADR, spec, runbook, or captured the missing doc work as follow-up.
- [x] I did not silently expand project scope without recording it explicitly.

## Closure Check

- [x] Working tree was clean after commit.
- [x] Branch was pushed and this PR is the active delivery artifact.
- [x] OpenSpec change is not needed, still active by design until merge, already archived, or queued for agent-driven archive closure.
- [x] Release is not applicable, delegated to release automation, or verified.

## Notes

合并后需按仓库流程将 OpenSpec change 归档并将 `cli-command-runtime` 规格合入 `openspec/specs/`（若提升为顶层 spec）。
