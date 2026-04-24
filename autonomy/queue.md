# Autonomy Queue

This queue is the prioritized entry point for future agent-driven work.

## Active queue

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| _None right now._ |

## Completed milestones

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| [qtx-0034](./tasks/qtx-0034-harden-release-trigger-governance.md) | `done` | `high` | Harden release trigger governance | qtx-0030, qtx-0032 |
| [qtx-0033](./tasks/qtx-0033-standardize-worktree-first-task-execution.md) | `done` | `high` | Standardize worktree-first task execution | - |
| [qtx-0031](./tasks/qtx-0031-harden-release-artifact-matrix-validation.md) | `done` | `high` | Harden release artifact matrix validation | qtx-0030 |
| [qtx-0030](./tasks/qtx-0030-adopt-release-please-release-pr-flow.md) | `done` | `high` | Adopt release-please Release PR flow | - |
| [qtx-0029](./tasks/qtx-0029-fix-semantic-release-trusted-publishing-on-main.md) | `done` | `high` | Fix semantic-release trusted publishing on main | - |
| [qtx-0028](./tasks/qtx-0028-replace-bumpp-with-merge-to-main-auto-release.md) | `done` | `high` | Replace bumpp with merge-to-main auto release | - |
| [qtx-0027](./tasks/qtx-0027-make-release-flow-compatible-with-pr-only-main.md) | `done` | `high` | Make release flow compatible with PR-only main | - |
| [qtx-0026](./tasks/qtx-0026-make-exec-surface-machine-actionable-install-guidance.md) | `done` | `high` | Make exec surface machine-actionable install guidance | - |
| [qtx-0024](./tasks/qtx-0024-fix-task-queue-insertion-when-active-queue-is-empty.md) | `done` | `medium` | Fix task queue insertion when active queue is empty | - |
| [qtx-0025](./tasks/qtx-0025-make-resolve-surface-machine-actionable-install-guidance.md) | `done` | `high` | Make resolve surface machine-actionable install guidance | - |
| [qtx-0001](./tasks/qtx-0001-migrate-troubleshooting-into-runbooks.md) | `done` | `high` | Migrate troubleshooting knowledge into canonical runbooks | - |
| [qtx-0002](./tasks/qtx-0002-consolidate-auto-upgrade-docs-into-openspec-and-adr.md) | `done` | `high` | Consolidate auto-upgrade design into OpenSpec specs and ADRs | - |
| [qtx-0003](./tasks/qtx-0003-convert-root-backlogs-into-task-contracts.md) | `done` | `medium` | Convert legacy root backlogs into autonomy task contracts | - |
| [qtx-0004](./tasks/qtx-0004-extract-self-upgrade-providers.md) | `done` | `high` | Extract self-upgrade provider modules | - |
| [qtx-0005](./tasks/qtx-0005-persist-self-install-source.md) | `done` | `high` | Persist self install source in state | qtx-0004 |
| [qtx-0006](./tasks/qtx-0006-introduce-self-upgrade-typed-errors.md) | `done` | `high` | Introduce typed errors for self-upgrade outcomes | qtx-0004 |
| [qtx-0007](./tasks/qtx-0007-add-binary-checksum-validation.md) | `done` | `high` | Add checksum validation for binary self-upgrade | qtx-0006 |
| [qtx-0008](./tasks/qtx-0008-add-self-upgrade-locking.md) | `done` | `medium` | Add locking for self-upgrade execution | qtx-0006 |
| [qtx-0009](./tasks/qtx-0009-add-post-upgrade-verify-and-rollback.md) | `done` | `medium` | Add post-upgrade verification and minimal rollback | qtx-0007, qtx-0008 |
| [qtx-0010](./tasks/qtx-0010-adopt-release-manifest-and-channel-selection.md) | `done` | `medium` | Adopt release manifest and explicit self-upgrade channels | qtx-0007 |
| [qtx-0011](./tasks/qtx-0011-add-version-cache-and-network-controls.md) | `done` | `medium` | Add version cache and network controls for upgrade checks | qtx-0010 |
| [qtx-0012](./tasks/qtx-0012-align-release-pipeline-with-upgrade-metadata.md) | `done` | `medium` | Align release pipeline with manifest and checksum metadata | - |
| [qtx-0013](./tasks/qtx-0013-introduce-agent-update-provider-model.md) | `done` | `high` | Introduce managed, self-update, and manual-hint agent update layers | - |
| [qtx-0014](./tasks/qtx-0014-extend-agent-definitions-for-self-update-and-version-probes.md) | `done` | `medium` | Extend agent definitions with self-update commands and version probes | qtx-0013 |
| [qtx-0015](./tasks/qtx-0015-unify-single-and-batch-agent-update-planning.md) | `done` | `medium` | Unify single-agent and batch agent update planning | qtx-0013, qtx-0014 |
| [qtx-0016](./tasks/qtx-0016-standardize-manual-hint-fallbacks-for-agent-update.md) | `done` | `low` | Standardize manual-hint fallbacks for agent update | qtx-0015 |
| [qtx-0017](./tasks/qtx-0017-improve-update-and-upgrade-lifecycle-summaries.md) | `done` | `medium` | Improve update and upgrade lifecycle summaries | - |
| [qtx-0018](./tasks/qtx-0018-expand-doctor-remediation-guidance.md) | `done` | `high` | Expand doctor remediation guidance | - |
| [qtx-0019](./tasks/qtx-0019-audit-and-expand-agent-catalog-update-metadata.md) | `done` | `high` | Audit and expand agent catalog update metadata | - |
| [qtx-0020](./tasks/qtx-0020-add-release-workflow-smoke-validation.md) | `done` | `high` | Add release workflow smoke validation | - |
| [qtx-0021](./tasks/qtx-0021-write-release-and-self-upgrade-debugging-runbook.md) | `done` | `medium` | Write release and self-upgrade debugging runbook | - |
| [qtx-0022](./tasks/qtx-0022-document-skill-installation-and-distribution-flow.md) | `done` | `low` | Document skill installation and distribution flow | - |
| [qtx-0023](./tasks/qtx-0023-make-doctor-output-machine-actionable-remediation.md) | `done` | `high` | Make doctor output machine-actionable remediation | - |

## Intake rules

- Add a task file before adding a queue entry.
- Prefer one task per coherent outcome.
- If a task changes behavior, link the relevant OpenSpec artifact.
- If a task changes a durable rule, link or create an ADR.
