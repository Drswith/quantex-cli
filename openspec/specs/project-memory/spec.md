# Project Memory Specification

## Purpose

Define how Quantex stores durable discussion outcomes, operational knowledge, and change history inside the repository.
## Requirements
### Requirement: Repo-native canonical memory

The project SHALL store long-lived project memory in versioned repository artifacts instead of relying on session memory alone.

#### Scenario: Choosing where to write durable knowledge

- GIVEN a contributor or agent needs to record a durable outcome from a discussion
- WHEN the information is design rationale, a runbook, a postmortem, a session summary, or a change contract
- THEN the contributor writes it into the canonical directory defined in `docs/README.md`
- AND does not create a new root-level ad hoc markdown file for that category

### Requirement: Root markdown allowlist SHALL track canonical README entry points

Repository-native project-memory checks MUST allow the current canonical root README files used for the product landing page and language switching.

#### Scenario: Repository checks root markdown files

- **WHEN** `bun run memory:check` evaluates root-level markdown files
- **THEN** it allows `README.md` as the canonical English landing page
- **AND** it allows `README.zh-CN.md` as the Simplified Chinese product entry point
- **AND** it may continue allowing compatibility README aliases that remain intentionally present

### Requirement: AGENTS.md must stay a thin execution handbook

The project SHALL keep `AGENTS.md` as a thin but self-contained execution handbook for coding agents. The file SHALL inline only the mission, non-goals, quickstart, hard constraints, validation triggers, intake and closure gates, file-scoped red lines, and trigger-based pointers needed to route detailed knowledge.

#### Scenario: Agent starts a repository session

- **WHEN** a coding agent reads `AGENTS.md` at the start of repository work
- **THEN** the file exposes the hard execution constraints without requiring another document to understand the guardrails
- **AND** the file does not depend on copied source trees, copied type definitions, or full command catalogs to remain useful

### Requirement: AGENTS.md pointers must route volatile details to source-of-truth artifacts

Drift-prone details referenced by `AGENTS.md` SHALL live in source-of-truth code, docs, or discovery commands and SHALL be reached through trigger-based pointers.

#### Scenario: Agent needs current source details

- **WHEN** the current task depends on up-to-date type definitions, command catalogs, schema surfaces, release workflow details, or architecture boundaries
- **THEN** `AGENTS.md` points the agent to the relevant source file, canonical doc, or discovery command
- **AND** the volatile detail is not duplicated inline inside `AGENTS.md`

### Requirement: Discussion outcomes must be promoted

The project SHALL treat session summaries as an intermediate artifact and promote stable conclusions into more durable documents when appropriate.

#### Scenario: Discussion produces a durable design decision

- GIVEN a session summary captures a lasting design or scope choice
- WHEN the choice is expected to matter beyond the current work session
- THEN the project records it as an ADR
- AND links the session summary to that ADR

#### Scenario: Discussion produces a non-trivial behavior change

- GIVEN a session defines or changes observable system behavior
- WHEN the change is larger than a trivial edit
- THEN the project records the change in `openspec/`
- AND keeps implementation detail out of the source-of-truth spec unless it is externally observable

### Requirement: Non-trivial changes MUST use OpenSpec as the proposal contract

The project SHALL use OpenSpec change folders as the default proposal and task contract for non-trivial behavior or durable-process changes.

#### Scenario: Planning a non-trivial behavior change

- GIVEN a contributor or agent plans a change that alters observable behavior, release policy, project memory policy, or durable development workflow
- WHEN the change is prepared for implementation
- THEN the project records it under `openspec/changes/<change-id>/`
- AND the change includes a proposal, task list, and any relevant spec delta before or alongside implementation

#### Scenario: Handling small fixes without OpenSpec overhead

- GIVEN a change is a small bug fix, documentation cleanup, or mechanical maintenance update
- WHEN it does not alter a behavior contract or durable process
- THEN the change MAY proceed through GitHub Issue/PR review without creating an OpenSpec change

### Requirement: Custom workflow command surface MUST stay out of the product repo

The project SHALL avoid growing project-specific workflow commands when an OpenSpec artifact or GitHub-native workflow can provide the same planning and review capability.

#### Scenario: Recording future executable work

- GIVEN follow-up work is actionable but does not need a non-trivial OpenSpec proposal
- WHEN a contributor needs to track it for implementation
- THEN the contributor records it as a GitHub issue
- AND links any relevant discussion, ADR, runbook, or OpenSpec artifact

#### Scenario: Avoiding custom workflow command growth

- GIVEN the project needs to scaffold or validate change proposals
- WHEN an official OpenSpec command or GitHub-native workflow can provide that capability
- THEN the project uses that external standard instead of adding project-specific CLI scripts

### Requirement: Historical task contracts MUST be preserved as OpenSpec archive history

The project SHALL preserve completed historical task contracts under `openspec/changes/archive/` instead of maintaining a parallel active task queue.

#### Scenario: Looking up old qtx task context

- GIVEN a contributor or agent needs context from a completed `qtx-*` task
- WHEN the original task queue has been retired
- THEN the contributor reads the migrated archived change under `openspec/changes/archive/`
- AND uses `openspec/changes/archive/qtx-task-history.md` as the index

### Requirement: Superpowers SHALL provide the cross-agent session runtime

Quantex SHALL use Superpowers as the preferred cross-agent runtime for coding-agent session startup, planning, implementation discipline, verification, and delivery closure. OpenSpec SHALL remain the source of truth for non-trivial change contracts and accepted project-memory state.

#### Scenario: Agent starts a Quantex session with Superpowers available

- **WHEN** a coding agent starts a new Quantex repository session
- **AND** Superpowers is available in that agent environment
- **THEN** the agent MUST activate Superpowers before planning or editing
- **AND** it MUST use the central Quantex agent runtime skill for repository-specific intake, validation, artifact routing, and closure rules

#### Scenario: Agent starts without Superpowers available

- **WHEN** a coding agent starts a Quantex repository session
- **AND** Superpowers is not available in that agent environment
- **THEN** the agent MUST follow the bootstrap fallback in `AGENTS.md`
- **AND** it MUST still use OpenSpec and repository validation commands as the source-of-truth workflow

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied OPSX workflow instructions separately for each supported coding agent. Agent-specific directories MAY contain thin bootstrap files whose purpose is to route the agent to Superpowers, the central Quantex runtime skill, and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific bootstrap files remain short pointers rather than full duplicate workflow copies

### Requirement: OPSX actions MUST be available across supported coding agents

The project SHALL make OpenSpec actions available across supported coding agents through the Superpowers-backed Quantex agent runtime. The runtime SHALL instruct agents to use official OpenSpec CLI commands such as `openspec status`, `openspec instructions`, `openspec validate`, and `openspec archive` instead of relying on copied per-agent OPSX command bodies.

#### Scenario: Agent starts a non-trivial change

- GIVEN a supported coding agent is asked to plan a non-trivial behavior or durable-process change
- WHEN the agent needs workflow guidance
- THEN it can use the Superpowers-backed Quantex runtime to choose explore, propose, apply, and archive behavior
- AND shared project-specific guidance comes from the central runtime skill, `openspec/config.yaml`, and current OpenSpec artifacts

### Requirement: Canonical docs must stay aligned with implementation

When implementation changes behavior, risk handling, or durable process, the corresponding project memory artifact SHALL be updated in the same change set or explicitly flagged for follow-up.

#### Scenario: Implementation reveals a new recurring recovery pattern

- GIVEN a change uncovers a reusable troubleshooting or recovery procedure
- WHEN the work is finalized
- THEN the relevant runbook is updated in the same change set
- OR a follow-up issue or OpenSpec change captures the missing documentation work

### Requirement: Completed OpenSpec changes MUST reach archive closure

When a non-trivial change is tracked in OpenSpec, the project SHALL treat implementation merge and archive closure as separate lifecycle moments, and SHALL close the change by archiving it after its accepted spec delta is synced. Archive closure SHALL be owned by the agent-driven delivery workflow instead of repository automation that automatically opens and merges archive PRs.

#### Scenario: Completed change lands on a protected branch

- **WHEN** an OpenSpec-backed implementation PR merges to a protected branch such as `main` or `beta`
- **THEN** the project keeps the merged code as implemented work
- **AND** an agent using the Quantex runtime follows up by syncing accepted spec deltas and archiving the completed change
- **AND** the agent reports whether archive closure is complete or still pending

#### Scenario: Agent performs archive follow-up

- **WHEN** an agent resumes archive closure for a completed OpenSpec change
- **THEN** it MUST run the relevant OpenSpec status and archive commands
- **AND** it MUST run `bun run openspec:validate`
- **AND** it MUST deliver the archive change through the normal commit, push, and PR path when protected branches prevent direct closure

### Requirement: Agent-driven OpenSpec archive closure MUST use repo-native executable guardrails

Agent-driven OpenSpec archive closure SHALL be performed through repository scripts that encapsulate status checks, archive state transition, OpenSpec validation, and PR body generation. The Quantex agent runtime SHALL route agents to those scripts instead of asking each session to hand-write archive commands and PR bodies.

#### Scenario: Agent archives completed OpenSpec changes

- **WHEN** an agent resumes archive closure for one or more completed OpenSpec changes
- **THEN** it MUST run the repository archive closure command for those changes
- **AND** the command MUST verify each change is complete before archiving
- **AND** the command MUST support the post-merge archive path where accepted spec deltas were already synced into `openspec/specs/`
- **AND** the command MUST run OpenSpec validation after archive state transition
- **AND** the command MUST generate a PR body that satisfies repository PR Governance headings and linked artifact requirements

#### Scenario: Agent prepares an archive closure pull request

- **WHEN** an archive closure branch is ready for PR delivery
- **THEN** the agent MUST use the generated PR body file or run the local PR body governance check before creating or editing the PR
- **AND** PR Governance in GitHub Actions MUST evaluate the PR body with the same repository validation logic

### Requirement: Work Intake Gate

Agents and contributors SHALL classify requested work before implementation or file edits begin.

#### Scenario: Implementation request starts

- **GIVEN** a user asks an agent to start, implement, land, continue, complete, or otherwise execute work
- **WHEN** the agent has enough context to identify the work type
- **THEN** the agent MUST classify whether the work requires OpenSpec before making file edits
- **AND** the agent MUST use an existing active OpenSpec change or create a new one when the work meets an OpenSpec trigger

#### Scenario: OpenSpec trigger is present

- **GIVEN** requested work changes observable CLI behavior, stable structured output, schema, agent catalog fields, configuration, state, release policy, project memory policy, durable workflow, architecture boundaries, or product-facing documentation
- **WHEN** implementation is about to begin
- **THEN** the work MUST have an OpenSpec change with proposal, relevant spec delta, design when useful, and tasks before or alongside implementation

#### Scenario: User asks to skip planning by saying start immediately

- **GIVEN** a user asks to start implementation until completion
- **WHEN** the work is non-trivial or the OpenSpec requirement is uncertain
- **THEN** the agent MUST NOT treat the wording as permission to skip the intake gate
- **AND** the agent MUST create or select the OpenSpec change before editing implementation files

#### Scenario: Work does not require OpenSpec

- **GIVEN** requested work is a typo fix, formatting-only cleanup, small dependency-free maintenance edit, or test-only adjustment that does not change behavior or durable process
- **WHEN** the agent proceeds without OpenSpec
- **THEN** the agent MUST briefly state the no-OpenSpec classification and continue through normal review and validation

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
- **AND** the agent MUST identify whether archive closure is pending, already complete, or delegated to a Superpowers/Quantex-runtime follow-up

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

### Requirement: Root markdown allowlist SHALL track canonical README entry points

Repository-native project-memory checks MUST allow the current canonical root README files used for the product landing page and language switching.

#### Scenario: Repository checks root markdown files

- **WHEN** `bun run memory:check` evaluates root-level markdown files
- **THEN** it allows `README.md` as the canonical English landing page
- **AND** it allows `README.zh-CN.md` as the Simplified Chinese product entry point
- **AND** it may continue allowing compatibility README aliases that remain intentionally present
