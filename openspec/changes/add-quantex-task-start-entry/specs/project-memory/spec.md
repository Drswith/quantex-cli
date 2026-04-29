## ADDED Requirements

### Requirement: Quantex task start entry SHALL be canonical and text-first

The project SHALL document a canonical task start entry that lets a user start or resume Quantex work from a fresh coding-agent conversation without relying on a specific agent's slash-command syntax. The entry MUST route the agent through Superpowers when available, the central Quantex runtime skill, OpenSpec intake, and worktree-backed implementation rules.

#### Scenario: User starts a task in a fresh agent conversation

- **WHEN** a user starts a new Quantex task from a fresh Codex, Claude Code, opencode, or comparable coding-agent conversation
- **THEN** the project provides a copy-paste task start prompt that tells the agent to use the central Quantex runtime
- **AND** the prompt tells the agent to inspect git state and active OpenSpec changes before editing
- **AND** the prompt tells the agent not to implement on `main` when work will create commits or a PR
- **AND** the prompt tells the agent to create or select an OpenSpec change when the intake gate requires one

#### Scenario: Agent supports slash commands or skills

- **WHEN** the current agent supports a slash command, skill invocation, or equivalent native workflow entry
- **THEN** the user MAY invoke the native entry for `quantex-agent-runtime`
- **AND** the native entry MUST remain a thin route to the central runtime instead of duplicating the full workflow body

#### Scenario: Agent does not support a task start command

- **WHEN** the current agent has no usable slash-command or skill invocation surface
- **THEN** the user can paste the canonical task start prompt directly into the conversation
- **AND** the agent still follows the same OpenSpec and worktree-backed workflow
