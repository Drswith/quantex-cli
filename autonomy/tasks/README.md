# Task Contracts

Each file in this directory is a task that an agent can execute with bounded autonomy.

Use `bun run task:new -- --title "Task title"` to scaffold a new task file without hand-editing frontmatter.

If the task will produce commits or a PR, start execution from a dedicated worktree with `bun run worktree:new`.

## Requirements

- every task has a stable ID
- every task states its done criteria
- every task lists dependencies and docs to update
- every task is narrow enough to complete without inventing broad new scope

Start from [_template.md](./_template.md).
