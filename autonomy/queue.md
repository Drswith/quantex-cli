# Autonomy Queue

This queue is the prioritized entry point for future agent-driven work.

## Active queue

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| [qtx-0017](./tasks/qtx-0017-improve-update-and-upgrade-lifecycle-summaries.md) | `done` | `medium` | Improve update and upgrade lifecycle summaries | - |
| [qtx-0018](./tasks/qtx-0018-expand-doctor-remediation-guidance.md) | `done` | `high` | Expand doctor remediation guidance | - |
| [qtx-0019](./tasks/qtx-0019-audit-and-expand-agent-catalog-update-metadata.md) | `done` | `high` | Audit and expand agent catalog update metadata | - |
| [qtx-0020](./tasks/qtx-0020-add-release-workflow-smoke-validation.md) | `done` | `high` | Add release workflow smoke validation | - |
| [qtx-0021](./tasks/qtx-0021-write-release-and-self-upgrade-debugging-runbook.md) | `done` | `medium` | Write release and self-upgrade debugging runbook | - |
| [qtx-0022](./tasks/qtx-0022-document-skill-installation-and-distribution-flow.md) | `planned` | `low` | Document skill installation and distribution flow | - |

## Completed milestones

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
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

## Intake rules

- Add a task file before adding a queue entry.
- Prefer one task per coherent outcome.
- If a task changes behavior, link the relevant OpenSpec artifact.
- If a task changes a durable rule, link or create an ADR.
