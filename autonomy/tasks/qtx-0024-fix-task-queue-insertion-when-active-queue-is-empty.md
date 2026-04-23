---
id: qtx-0024
title: Fix task queue insertion when active queue is empty
status: done
priority: medium
area: autonomy
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - autonomy/queue.md
---

# Task: Fix task queue insertion when active queue is empty

## Goal

Make `bun run task:new -- --queue` place new rows into the correct queue section even when the active queue is currently empty.

## Context

The second-round workflow exposed a real autonomy gap: scaffolding a new queued task while `autonomy/queue.md` had no active items inserted the row into the wrong section. That makes the queue a less reliable entry point for future agents.

## Constraints

- Keep the fix scoped to queue insertion behavior.
- Preserve the current queue layout and intake rules instead of redesigning the file format.

## Implementation Notes

- Relevant files: `scripts/new-task.ts`, `scripts/project-memory-utils.ts`, `test/project-memory-utils.test.ts`
- Relevant commands: `bun run task:new -- --queue`
- Relevant specs or ADRs: none; this is a project-memory workflow fix

## Done When

- Non-`done` tasks created with `--queue` appear in the active queue section.
- `done` tasks created with `--queue` appear in completed milestones.
- A regression test covers the empty-active-queue case.

## Non-Goals

- Redesigning the autonomy queue format
- Introducing a separate task database or planner service
