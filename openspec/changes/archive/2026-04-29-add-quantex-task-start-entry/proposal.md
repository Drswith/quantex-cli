# Proposal: Add Quantex task start entry

## Why

Quantex already has the pieces for cross-agent work: Superpowers, a central runtime skill, OpenSpec, worktree guidance, and thin agent bootstraps. The missing piece is a clear, repeatable "start a new task" entry that a user can paste into a fresh Codex, Claude Code, or opencode session without knowing each agent's slash-command details.

Without that entry, users can reasonably expect `/something` to exist and become confused when the project has workflow rules but no obvious task-start affordance.

## What Changes

- Define a canonical Quantex task start prompt that works across agents.
- Update the central runtime skill so task start/resume behavior is explicit.
- Add a runbook explaining how to start a task from a fresh conversation, with or without slash-command support.
- Keep the implementation lightweight: no Quantex product command, no repo-local orchestration wrapper, and no duplicated full workflow bodies per agent.
