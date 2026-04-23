# Runbook: Worktree-Backed Task Execution

## Purpose

Provide the canonical setup and cleanup flow for implementing Quantex tasks from dedicated git worktrees.

## When to use

- you are starting a task that will create commits or a PR
- the current workspace already has local changes
- multiple tasks or release-related branches may be active in parallel
- you want the user's main IDE workspace to stay on its current branch

## Inputs

- task id or short task title
- base branch or ref, usually `main`
- `bun run worktree:new`
- `git worktree list`

## Triage order

1. Decide whether the work is read-only. If it will produce commits or a PR, use a dedicated worktree by default.
2. Create the worktree:

   ```bash
   bun run worktree:new -- --task qtx-0000 --title "Task title"
   ```

3. Verify the new workspace:

   ```bash
   git -C ../quantex-cli-qtx-0000-task-title status --short --branch
   ```

4. Implement, commit, push, and open the PR from the worktree path rather than switching the user's primary workspace.
5. After the branch is merged or intentionally abandoned, remove the worktree and prune stale metadata:

   ```bash
   git worktree remove ../quantex-cli-qtx-0000-task-title
   git worktree prune
   ```

## Recovery

If the target path already exists, inspect `git worktree list` before deleting or reusing it.

If the branch name is wrong, remove the unused worktree and rerun `bun run worktree:new` with `--branch`, `--task`, or `--title`.

If cleanup fails because the branch still has unique commits, compare it against the intended base first:

```bash
git log --oneline main..codex/qtx-0000-task-title
```

## Escalation

Stop and ask for human input when:

- the worktree contains unmerged or unpushed commits you did not create
- the task appears to require in-place edits inside the user's active workspace
- you need to reuse protected or automation-managed branches such as `main`, `beta`, or `release-please...`

## Related artifacts

- [ADR 0004](../adr/0004-standardize-worktree-first-task-execution.md)
- [qtx-0033](../../autonomy/tasks/qtx-0033-standardize-worktree-first-task-execution.md)
- [GitHub Collaboration Flow](../github-collaboration.md)
