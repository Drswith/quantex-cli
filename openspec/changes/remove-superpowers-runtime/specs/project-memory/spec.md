## ADDED Requirements

### Requirement: Central Quantex agent runtime SHALL drive cross-agent sessions

Quantex SHALL use `skills/quantex-agent-runtime/SKILL.md` as the central repository-session guide for coding-agent startup, planning, implementation discipline, verification, and delivery closure. OpenSpec SHALL remain the source of truth for non-trivial change contracts and accepted project-memory state.

#### Scenario: Agent starts a Quantex session

- **WHEN** a coding agent starts a new Quantex repository session
- **THEN** the agent MUST read and follow the central Quantex agent runtime skill before planning or editing
- **AND** it MUST use OpenSpec and repository validation commands for the source-of-truth workflow

### Requirement: Historical Superpowers records SHALL be preserved in docs/archive

The project SHALL preserve existing historical Markdown records under `docs/archive/superpowers/` without treating them as active runtime dependencies or rewriting their historical terminology or paths.

#### Scenario: Maintainer removes current Superpowers dependency

- **WHEN** a maintainer removes Superpowers from current agent guidance
- **THEN** the maintainer MUST move existing historical-record Markdown into `docs/archive/superpowers/` intact
- **AND** current entry manuals and runtime skills MUST NOT require Superpowers activation or instructions

### Requirement: OpenSpec actions MUST be available across supported coding agents

The project SHALL make OpenSpec actions available across supported coding agents through the central Quantex agent runtime. The runtime SHALL instruct agents to use official OpenSpec CLI commands such as `openspec status`, `openspec instructions`, `openspec validate`, and `openspec archive` instead of relying on copied workflow command bodies.

#### Scenario: Agent starts a non-trivial change

- GIVEN a supported coding agent is asked to plan a non-trivial behavior or durable-process change
- WHEN the agent needs workflow guidance
- THEN it can use the central Quantex runtime to choose explore, propose, apply, and archive behavior
- AND shared project-specific guidance comes from the central runtime skill, `openspec/config.yaml`, and current OpenSpec artifacts

## MODIFIED Requirements

### Requirement: Quantex task start entry SHALL be canonical and text-first

The project SHALL document a canonical task start entry that lets a user start or resume Quantex work from a fresh coding-agent conversation without relying on a specific agent's slash-command syntax. The entry MUST route the agent through the central Quantex runtime skill, OpenSpec intake, and worktree-backed implementation rules.

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

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied workflow instructions separately for each supported coding agent. The repository also SHALL NOT treat checked-in agent-specific skill mirrors as canonical workflow contracts. Agent-specific integration files MAY exist only when they are necessary for a supported environment and SHALL remain short routes to the central Quantex runtime skill and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific integration files remain short pointers rather than full duplicate workflow copies
- **AND** checked-in per-agent skill mirrors are not required for Claude, Cursor, Gemini, OpenCode, or comparable agents when the central text-first runtime entry remains available

#### Scenario: Agent-specific generated environment metadata exists

- **WHEN** the repository includes environment setup metadata for a specific hosted agent integration
- **THEN** that metadata may describe setup commands or provisioning details
- **AND** it does not become the source of truth for durable Quantex workflow policy

### Requirement: Delivery Closure Gate

Agents and contributors SHALL perform delivery closure checks before reporting implementation work as complete.

#### Scenario: Agent prepares final answer after implementation

- **GIVEN** an agent has implemented, documented, or otherwise changed repository files
- **WHEN** the agent is ready to report completion
- **THEN** the agent MUST check OpenSpec status, validation status, git status, commit status, push status, and PR status as applicable
- **AND** the final answer MUST distinguish completed work from any remaining merge, release, or archive closure step

#### Scenario: OpenSpec-backed work reaches PR delivery

- **GIVEN** work was tracked by an OpenSpec change
- **WHEN** the agent creates or updates the implementation PR
- **THEN** the agent MUST state whether the OpenSpec change remains active by design until merge
- **AND** the agent MUST identify whether archive closure is pending, already complete, or delegated to a Quantex-runtime follow-up

#### Scenario: User requests closure

- **GIVEN** a user asks an agent to continue work or reach closure
- **WHEN** repository permissions and remote services allow continued progress
- **THEN** the agent MUST continue through validation, commit, push, and PR creation instead of stopping at local implementation
- **AND** if merge, release, or archive closure cannot be completed immediately, the agent MUST name the blocker and the exact next closure owner

#### Scenario: No remaining closure work

- **GIVEN** implementation, validation, commit, push, PR, merge, release, and OpenSpec archive expectations have been evaluated for the requested scope
- **WHEN** no required closure step remains for the current actor
- **THEN** the agent MAY report the task as closed
- **AND** the report MUST include the checked closure state rather than only a code-change summary

### Requirement: Repository workflow scripts MUST remain guardrails instead of orchestration commands

Repository scripts that support the agent workflow SHALL remain focused on validation, classification, generation of build or release artifacts, and other executable guardrails. The project MUST NOT add repo-local workflow wrapper commands when central runtime instructions plus official CLIs such as `gh`, `git`, and `openspec` can perform the action with the same reviewability.

#### Scenario: A workflow gap is discovered

- **GIVEN** a recurring agent delivery failure is discovered
- **WHEN** a maintainer chooses how to fix it
- **THEN** the maintainer MUST prefer central runtime instructions, OpenSpec contracts, GitHub-native workflow enforcement, or a narrow validator over a new repo-local orchestration command

#### Scenario: Native tool plus validator is sufficient

- **GIVEN** an agent needs to create or edit a pull request
- **WHEN** the repository already exposes a local validator for the PR body
- **THEN** the project MUST keep the action on the native GitHub CLI
- **AND** it MUST NOT add a project-specific PR creation command solely to sequence that native action

## REMOVED Requirements

### Requirement: Superpowers SHALL provide the cross-agent session runtime

**Reason**: Superpowers is no longer a Quantex repository-session dependency; the central runtime skill and repo-native workflow artifacts provide the required guidance.

**Migration**: Start through `skills/quantex-agent-runtime/SKILL.md`, then follow `AGENTS.md`, OpenSpec, native CLIs, and repository validation.

### Requirement: OPSX actions MUST be available across supported coding agents

**Reason**: The project standardizes on the OpenSpec name and CLI rather than a separate OPSX workflow layer.

**Migration**: Use the added OpenSpec-actions requirement and the central runtime skill.
