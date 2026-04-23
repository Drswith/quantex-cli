# Autonomy

This directory defines how Quantex can evolve toward agent-driven iteration without losing control of scope or quality.

## What lives here

| File | Purpose |
|---|---|
| `policy.md` | Rules for what an agent may do autonomously and when to escalate |
| `queue.md` | Ordered backlog of tasks that are ready or planned |
| `tasks/` | Individual task contracts with explicit done criteria |

## Expected loop

1. Read `queue.md`.
2. Pick the highest-priority task that is `ready` and not blocked by dependencies.
3. Read the task file and any linked ADRs, specs, or runbooks.
4. Implement the change, run the required checks, and update relevant docs.
5. Update task status and record any new follow-up tasks.

The goal is not blind automation. The goal is bounded, reviewable autonomy.
