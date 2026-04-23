# Autonomy Policy

Quantex allows bounded agent autonomy. The agent is expected to move work forward, but only inside explicit constraints.

## Principles

### Repo-native truth

Long-lived project memory belongs in versioned files inside this repository, not only in session memory.

### Explicit task contracts

Work should flow through task files with scope, risks, dependencies, and done criteria.

### Safe defaults

The agent may make local implementation decisions inside an accepted task, but should not silently expand product scope.

### Workspace isolation

When accepted work is expected to produce commits or a PR, prefer a dedicated git worktree instead of switching the user's active workspace in place.

### Promotion over accumulation

Discussion output should be promoted into specs, ADRs, runbooks, postmortems, and tasks instead of accumulating as loose notes.

## The agent may do autonomously

- implement tasks marked `ready`
- split a large task into smaller tasks when that reduces risk
- update specs, ADR follow-up links, runbooks, and task status when the change requires it
- add tests, checks, and migration notes that are directly implied by the accepted task
- create dedicated task worktrees and branches for implementation work
- remove a dedicated task worktree after its changes are merged or intentionally abandoned

## The agent must escalate before proceeding

- changing product scope or non-goals
- making destructive data or state migrations
- publishing releases or changing release channels
- introducing new external services, paid dependencies, or credentials
- deleting legacy documents before their canonical replacement exists
- overriding an accepted ADR
- implementing PR-bound changes directly in a user's active dirty workspace when a worktree-backed flow is feasible
- removing a worktree whose unmerged commits or ownership are unclear

## Done criteria

A task is not done until:

- the requested code or docs change is implemented
- required checks in the task file have been run or explicitly reported as not run
- related specs, ADRs, runbooks, or postmortems have been updated when needed
- new follow-up work is either captured in `autonomy/tasks/` or recorded as not needed

## Status model

Use these task statuses:

- `idea`
- `planned`
- `ready`
- `in_progress`
- `blocked`
- `review`
- `done`
