---
id: qtx-0003
title: Convert legacy root backlogs into autonomy task contracts
status: ready
priority: medium
area: docs
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - autonomy/queue.md
  - autonomy/tasks/
---

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
