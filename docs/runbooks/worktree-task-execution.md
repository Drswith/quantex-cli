# Runbook: Worktree-Backed Implementation

## Purpose

Provide the setup and cleanup flow for implementing Quantex changes from dedicated git worktrees without relying on project-specific scaffolding commands.

## When to use

- you are starting work that will create commits or a PR
- the current workspace already has local changes
- multiple branches may be active in parallel
- you want the user's main IDE workspace to stay on its current branch

## Inputs

- issue number, OpenSpec change id, or short change title
- base branch or ref, usually `main`
- `git worktree list`

## Triage order

1. Decide whether the work is read-only. If it will produce commits or a PR, use a dedicated worktree by default.
2. Choose a branch and path using the same slug:

   ```bash
   git worktree add -b <agent>/<issue-or-change-slug> ../quantex-cli-<issue-or-change-slug> main
   ```

3. Verify the new workspace:

   ```bash
   git -C ../quantex-cli-<issue-or-change-slug> status --short --branch
   ```

4. Implement, commit, push, and open the PR from the worktree path rather than switching the user's primary workspace.
5. After the branch is merged or intentionally abandoned, remove the worktree and prune stale metadata:

   ```bash
   git worktree remove ../quantex-cli-<issue-or-change-slug>
   git worktree prune
   ```

## Recovery

If the target path already exists, inspect `git worktree list` before deleting or reusing it.

If the branch name is wrong, remove the unused worktree and recreate it with the intended branch and path.

If cleanup fails because the branch still has unique commits, compare it against the intended base first:

```bash
git log --oneline main..<agent>/<issue-or-change-slug>
```

## Escalation

Stop and ask for human input when:

- the worktree contains unmerged or unpushed commits you did not create
- the work appears to require in-place edits inside the user's active workspace
- you need to reuse protected or automation-managed branches such as `main`, `beta`, or `release-please...`

## Related artifacts

- [ADR 0004](../adr/0004-standardize-worktree-first-task-execution.md)
- [qtx-0033 archive](../../openspec/changes/archive/qtx-0033-standardize-worktree-first-task-execution/proposal.md)
- [GitHub Collaboration Flow](../github-collaboration.md)
