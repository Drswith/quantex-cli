---
name: quantex-agent-runtime
description: Use when starting or resuming any Quantex repository task; activate Superpowers and follow the central Quantex runtime.
license: MIT
---

# Quantex Agent Runtime Bootstrap

Activate Superpowers first when available.

Then read and follow:

- `skills/quantex-agent-runtime/SKILL.md`
- `AGENTS.md`
- `openspec/README.md`

For new task start or resume, use the "Task Start Entry" in the central runtime skill. Native slash or skill commands are only launchers; OpenSpec, worktrees, branches, and PRs remain the source of truth.

Do not use copied OPSX workflow bodies from agent-specific directories. OpenSpec remains the source of truth for change contracts; this bootstrap only routes the session to the central runtime.
