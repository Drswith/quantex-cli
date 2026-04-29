# Design: Quantex task start entry

## Shape

The task start entry is a documented prompt/runbook pattern, not a new product command. Agents that support skills or slash commands can use their native entry to invoke `quantex-agent-runtime`; agents without that support can paste the canonical prompt.

The runtime still owns the session behavior:

1. Activate Superpowers when available.
2. Read the central runtime and `AGENTS.md`.
3. Inspect git and OpenSpec state.
4. Classify the request through the intake gate.
5. Use a dedicated worktree/branch for implementation work by default.

## Rationale

This keeps Quantex aligned with the existing non-goal: do not turn the project into a workflow orchestration platform. The entry removes ambiguity for humans and agents while leaving actual state in repo-native artifacts: OpenSpec changes, worktrees, branches, PRs, and archive closure.

## Compatibility

The entry is intentionally text-first:

- Codex can trigger the runtime skill by name.
- Claude Code and opencode can use their agent-specific bootstrap skills when available.
- Any agent can paste the fallback prompt and still reach the same repo-native workflow.

No assumptions are made about a universal slash command syntax across agents.
