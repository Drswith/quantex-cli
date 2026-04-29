# Runbook: Quantex Task Start

## Purpose

Provide one repeatable way to start or resume Quantex work from a fresh coding-agent conversation, regardless of whether the user starts in Codex, Claude Code, opencode, or another compatible agent.

## When to use

- you are starting a task that may create commits or a PR
- you are resuming a task from a new conversation
- you are unsure whether the current agent supports slash commands or skills
- you want to avoid accidental edits on `main`

## Canonical start prompt

Paste this into a fresh agent conversation:

```text
Use quantex-agent-runtime.
Activate Superpowers first if this environment supports it.
Read AGENTS.md, skills/quantex-agent-runtime/SKILL.md, and openspec/README.md.
Check git status, the current branch, git worktree list, and bun run openspec:list.
If this will create commits or a PR, do not work on main; create or switch to a dedicated worktree branch named <agent>/<task-slug>.
Classify the request through the OpenSpec intake gate before editing files.
If OpenSpec is required, create or select the change and use openspec status/instructions to drive implementation.
Continue through validation, commit, push, PR delivery, and archive-closure reporting as far as permissions allow.
```

If the agent has a native slash command or skill picker for `quantex-agent-runtime`, use that first. If it does not, paste the prompt above. The command or skill is only the launcher; project state still lives in git worktrees, branches, OpenSpec changes, PRs, and archive closure.

## Worktree start

For implementation work, start from an up-to-date `main` and create a dedicated worktree:

```bash
git switch main
git pull --ff-only
git worktree add -b <agent>/<task-slug> ../quantex-cli-<task-slug> main
cd ../quantex-cli-<task-slug>
git status --short --branch
```

Examples:

```bash
git worktree add -b codex/task-start-entry ../quantex-cli-task-start-entry main
git worktree add -b claude/agent-catalog ../quantex-cli-agent-catalog main
git worktree add -b opencode/sandbox-smoke ../quantex-cli-sandbox-smoke main
```

## Resume checklist

When resuming from a fresh conversation, ask the agent to run:

```bash
git status --short --branch
git worktree list
bun run openspec:list
```

If the task already has an OpenSpec change, continue with:

```bash
bun run openspec:status -- --change <change-id>
bun run openspec:instructions -- tasks --change <change-id>
```

## What not to do

- Do not treat a slash command as project memory.
- Do not implement on `main` when the task will create commits or a PR.
- Do not duplicate full workflow instructions into agent-specific bootstrap files.
- Do not add repo-local workflow wrapper commands when native `git`, `gh`, OpenSpec, and Superpowers instructions are enough.

## Related artifacts

- [AGENTS.md](../../AGENTS.md)
- [GitHub Collaboration Flow](../github-collaboration.md)
- [Worktree-Backed Implementation](./worktree-task-execution.md)
- [OpenSpec README](../../openspec/README.md)
- [Quantex Agent Runtime](../../skills/quantex-agent-runtime/SKILL.md)
