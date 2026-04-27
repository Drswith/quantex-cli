# QTX Task History

These archived OpenSpec changes preserve the completed task contracts that previously lived in `autonomy/tasks/` and `autonomy/queue.md`.

The active workflow no longer uses the custom autonomy task queue. New non-trivial behavior or durable-process work should start in `openspec/changes/`; small executable work should be tracked with GitHub issues and PRs.

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| [qtx-0001](./qtx-0001-migrate-troubleshooting-into-runbooks/proposal.md) | `done` | `high` | Migrate troubleshooting knowledge into canonical runbooks | - |
| [qtx-0002](./qtx-0002-consolidate-auto-upgrade-docs-into-openspec-and-adr/proposal.md) | `done` | `high` | Consolidate auto-upgrade design into OpenSpec specs and ADRs | - |
| [qtx-0003](./qtx-0003-convert-root-backlogs-into-task-contracts/proposal.md) | `done` | `medium` | Convert legacy root backlogs into autonomy task contracts | - |
| [qtx-0004](./qtx-0004-extract-self-upgrade-providers/proposal.md) | `done` | `high` | Extract self-upgrade provider modules | - |
| [qtx-0005](./qtx-0005-persist-self-install-source/proposal.md) | `done` | `high` | Persist self install source in state | qtx-0004 |
| [qtx-0006](./qtx-0006-introduce-self-upgrade-typed-errors/proposal.md) | `done` | `high` | Introduce typed errors for self-upgrade outcomes | qtx-0004 |
| [qtx-0007](./qtx-0007-add-binary-checksum-validation/proposal.md) | `done` | `high` | Add checksum validation for binary self-upgrade | qtx-0006 |
| [qtx-0008](./qtx-0008-add-self-upgrade-locking/proposal.md) | `done` | `medium` | Add locking for self-upgrade execution | qtx-0006 |
| [qtx-0009](./qtx-0009-add-post-upgrade-verify-and-rollback/proposal.md) | `done` | `medium` | Add post-upgrade verification and minimal rollback | qtx-0007, qtx-0008 |
| [qtx-0010](./qtx-0010-adopt-release-manifest-and-channel-selection/proposal.md) | `done` | `medium` | Adopt release manifest and explicit self-upgrade channels | qtx-0007 |
| [qtx-0011](./qtx-0011-add-version-cache-and-network-controls/proposal.md) | `done` | `medium` | Add version cache and network controls for upgrade checks | qtx-0010 |
| [qtx-0012](./qtx-0012-align-release-pipeline-with-upgrade-metadata/proposal.md) | `done` | `medium` | Align release pipeline with manifest and checksum metadata | - |
| [qtx-0013](./qtx-0013-introduce-agent-update-provider-model/proposal.md) | `done` | `high` | Introduce managed, self-update, and manual-hint agent update layers | - |
| [qtx-0014](./qtx-0014-extend-agent-definitions-for-self-update-and-version-probes/proposal.md) | `done` | `medium` | Extend agent definitions with self-update commands and version probes | qtx-0013 |
| [qtx-0015](./qtx-0015-unify-single-and-batch-agent-update-planning/proposal.md) | `done` | `medium` | Unify single-agent and batch agent update planning | qtx-0013, qtx-0014 |
| [qtx-0016](./qtx-0016-standardize-manual-hint-fallbacks-for-agent-update/proposal.md) | `done` | `low` | Standardize manual-hint fallbacks for agent update | qtx-0015 |
| [qtx-0017](./qtx-0017-improve-update-and-upgrade-lifecycle-summaries/proposal.md) | `done` | `medium` | Improve update and upgrade lifecycle summaries | - |
| [qtx-0018](./qtx-0018-expand-doctor-remediation-guidance/proposal.md) | `done` | `high` | Expand doctor remediation guidance | - |
| [qtx-0019](./qtx-0019-audit-and-expand-agent-catalog-update-metadata/proposal.md) | `done` | `high` | Audit and expand agent catalog update metadata | - |
| [qtx-0020](./qtx-0020-add-release-workflow-smoke-validation/proposal.md) | `done` | `high` | Add release workflow smoke validation | - |
| [qtx-0021](./qtx-0021-write-release-and-self-upgrade-debugging-runbook/proposal.md) | `done` | `medium` | Write release and self-upgrade debugging runbook | - |
| [qtx-0022](./qtx-0022-document-skill-installation-and-distribution-flow/proposal.md) | `done` | `low` | Document skill installation and distribution flow | - |
| [qtx-0023](./qtx-0023-make-doctor-output-machine-actionable-remediation/proposal.md) | `done` | `high` | Make doctor output machine-actionable remediation | - |
| [qtx-0024](./qtx-0024-fix-task-queue-insertion-when-active-queue-is-empty/proposal.md) | `done` | `medium` | Fix task queue insertion when active queue is empty | - |
| [qtx-0025](./qtx-0025-make-resolve-surface-machine-actionable-install-guidance/proposal.md) | `done` | `high` | Make resolve surface machine-actionable install guidance | - |
| [qtx-0026](./qtx-0026-make-exec-surface-machine-actionable-install-guidance/proposal.md) | `done` | `high` | Make exec surface machine-actionable install guidance | - |
| [qtx-0027](./qtx-0027-make-release-flow-compatible-with-pr-only-main/proposal.md) | `done` | `high` | Make release flow compatible with PR-only main | - |
| [qtx-0028](./qtx-0028-replace-bumpp-with-merge-to-main-auto-release/proposal.md) | `done` | `high` | Replace bumpp with merge-to-main auto release | - |
| [qtx-0029](./qtx-0029-fix-semantic-release-trusted-publishing-on-main/proposal.md) | `done` | `high` | Fix semantic-release trusted publishing on main | - |
| [qtx-0030](./qtx-0030-adopt-release-please-release-pr-flow/proposal.md) | `done` | `high` | Adopt release-please Release PR flow | - |
| [qtx-0031](./qtx-0031-harden-release-artifact-matrix-validation/proposal.md) | `done` | `high` | Harden release artifact matrix validation | qtx-0030 |
| [qtx-0032](./qtx-0032-verify-beta-release-channel/proposal.md) | `done` | `high` | Verify beta release channel | qtx-0030, qtx-0031 |
| [qtx-0033](./qtx-0033-standardize-worktree-first-task-execution/proposal.md) | `done` | `high` | Standardize worktree-first task execution | - |
| [qtx-0034](./qtx-0034-harden-release-trigger-governance/proposal.md) | `done` | `high` | Harden release trigger governance | qtx-0030, qtx-0032 |
| [qtx-0035](./qtx-0035-automate-release-pr-merge/proposal.md) | `done` | `high` | Automate release PR merge | qtx-0030, qtx-0034 |
| [qtx-0036](./qtx-0036-speed-up-windows-ci-and-align-registry/proposal.md) | `done` | `high` | Speed up Windows CI and align registry usage | qtx-0034 |
| [qtx-0037](./qtx-0037-adopt-github-app-release-bot/proposal.md) | `done` | `high` | Adopt GitHub App release bot | qtx-0030, qtx-0035 |
| [qtx-0038](./qtx-0038-verify-stable-release-automation/proposal.md) | `done` | `high` | Verify stable release automation | qtx-0037 |
