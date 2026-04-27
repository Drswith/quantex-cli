# qtx-0003: Convert legacy root backlogs into autonomy task contracts

> Migrated from `autonomy/tasks/qtx-0003-convert-root-backlogs-into-task-contracts.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | docs |
| Depends on | - |
| Human review | `suggested` |
| Docs to update | autonomy/queue.md, autonomy/tasks/ |

## Historical Task Contract

# Task: Convert legacy root backlogs into autonomy task contracts

## Goal

Replace backlog-style root markdown lists with explicit task contracts that can be executed by future agents.

## Context

`TODO.md` and `HUMAN_AGENT_DUAL_MODE_CLI_IMPLEMENTATION_BACKLOG.md` contain useful work items, but they are not yet shaped as bounded tasks with dependencies or done criteria.

## Constraints

- Keep backlog history discoverable during migration.
- Avoid creating oversized tasks that reintroduce ambiguity.

## Implementation Notes

- Split backlog bullets into coherent tasks.
- Add dependencies where work is ordered.
- Trim `autonomy/queue.md` so it remains a high-signal current queue rather than a long archive.

## Done When

- Key backlog items are represented as task files.
- The queue shows clear next work for an agent.
- Root backlog files no longer need to grow.

## Non-Goals

- Completing every queued implementation task in the same pass.
