# Autonomy Queue

This queue is the prioritized entry point for future agent-driven work.

## Active queue

| ID | Status | Priority | Title | Depends on |
|---|---|---|---|---|
| [qtx-0001](./tasks/qtx-0001-migrate-troubleshooting-into-runbooks.md) | `done` | `high` | Migrate troubleshooting knowledge into canonical runbooks | - |
| [qtx-0002](./tasks/qtx-0002-consolidate-auto-upgrade-docs-into-openspec-and-adr.md) | `planned` | `high` | Consolidate auto-upgrade design into OpenSpec specs and ADRs | - |
| [qtx-0003](./tasks/qtx-0003-convert-root-backlogs-into-task-contracts.md) | `ready` | `medium` | Convert legacy root backlogs into autonomy task contracts | - |

## Intake rules

- Add a task file before adding a queue entry.
- Prefer one task per coherent outcome.
- If a task changes behavior, link the relevant OpenSpec artifact.
- If a task changes a durable rule, link or create an ADR.
