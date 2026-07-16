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

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied OPSX workflow instructions separately for each supported coding agent. The repository also SHALL NOT treat checked-in agent-specific skill mirrors as canonical workflow contracts. Agent-specific integration files MAY exist only when they are necessary for a supported environment and SHALL remain short routes to Superpowers, the central Quantex runtime skill, and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific integration files remain short pointers rather than full duplicate workflow copies
- **AND** checked-in per-agent skill mirrors are not required for Claude, Cursor, Gemini, OpenCode, or comparable agents when the central text-first runtime entry remains available

#### Scenario: Agent-specific generated environment metadata exists

- **WHEN** the repository includes environment setup metadata for a specific hosted agent integration
- **THEN** that metadata may describe setup commands or provisioning details
- **AND** it does not become the source of truth for durable Quantex workflow policy

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

### Requirement: Cloud-agent automation roles SHALL be documented in repo-native project memory

Quantex SHALL keep the durable responsibilities, prompt baselines, trigger expectations, and output boundaries for external cloud-agent automations in repository documentation. The external automation provider configuration MAY hold the actual schedules, connected tools, and model selections, but it MUST NOT be the only source of durable role intent.

#### Scenario: Maintainer configures external cloud-agent automation

- **GIVEN** a maintainer creates or updates a Cursor Cloud Automation or comparable external cloud-agent automation for Quantex
- **WHEN** the automation changes durable workflow behavior, PR review behavior, CI triage behavior, release/archive follow-up, or prompt expectations
- **THEN** the repository MUST document the role contract, prompt baseline, and output boundary in a runbook or OpenSpec change
- **AND** the maintainer MUST NOT add a repo-local workflow orchestration command solely to mirror the external automation setup

#### Scenario: Agent audits cloud-agent automation drift

- **GIVEN** an agent or maintainer reviews existing external automation settings
- **WHEN** they compare those settings against repository source
- **THEN** they use the cloud-agent automation runbook and the Quantex runtime skill as the repo-native baseline
- **AND** they report provider-side schedule, model, or connection drift separately from repository contract drift

### Requirement: Cloud-agent roles MUST stay separated from CI enforcement

Cloud-agent automations SHALL classify, review, summarize, propose, or open narrow follow-up pull requests according to their role. They MUST NOT replace merge-gating CI, PR Governance, OpenSpec validation, release automation, or required local preflight checks.

#### Scenario: CI fails after a pull request update

- **WHEN** a cloud-agent CI triage role inspects a failing GitHub Actions run
- **THEN** it classifies the first real failure as product regression, workflow or policy failure, environment/quota/secret issue, transient external failure, or expected skipped context
- **AND** it reports the owner and minimal next step
- **AND** it does not implement code changes unless a separate implementation agent or user explicitly takes that work through the Quantex runtime intake gate

#### Scenario: PR Governance automation reviews a pull request

- **WHEN** a cloud-agent PR governance role reviews a pull request
- **THEN** it may leave blocking or non-blocking comments and request reviewers
- **AND** it MUST NOT approve the pull request
- **AND** GitHub Actions PR Governance remains responsible for enforcing required body, scope, release-intent, and merge-commit policy checks

#### Scenario: Cloud bug finder identifies no high-severity issue

- **WHEN** a cloud-agent bug-finding role inspects recent history without finding a concrete high-severity correctness bug
- **THEN** it sends a concise summary through the configured notification channel instead of opening a speculative pull request
- **AND** it keeps low-confidence concerns out of the merge queue

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

### Requirement: Repository workflow scripts MUST remain guardrails instead of orchestration commands

Repository scripts that support the agent workflow SHALL remain focused on validation, classification, generation of build or release artifacts, and other executable guardrails. The project MUST NOT add repo-local workflow wrapper commands when Superpowers runtime instructions plus official CLIs such as `gh`, `git`, and `openspec` can perform the action with the same reviewability.

#### Scenario: A workflow gap is discovered

- **GIVEN** a recurring agent delivery failure is discovered
- **WHEN** a maintainer chooses how to fix it
- **THEN** the maintainer MUST prefer central runtime instructions, OpenSpec contracts, GitHub-native workflow enforcement, or a narrow validator over a new repo-local orchestration command

#### Scenario: Native tool plus validator is sufficient

- **GIVEN** an agent needs to create or edit a pull request
- **WHEN** the repository already exposes a local validator for the PR body
- **THEN** the project MUST keep the action on the native GitHub CLI
- **AND** it MUST NOT add a project-specific PR creation command solely to sequence that native action

### Requirement: Quantex Runtime Skill Is Contributor-Facing

The central Quantex agent runtime skill SHALL be treated as a repository development workflow artifact for contributors and coding agents working inside this repository, not as the normal user-facing skill for operating Quantex.

#### Scenario: Maintainer documents repo-local skills

- **WHEN** repo-local skills are described in project memory or distribution docs
- **THEN** `skills/quantex-cli` is identified as the user/agent-facing Quantex operation skill
- **AND** `skills/quantex-agent-runtime` is identified as contributor-facing repository workflow runtime

#### Scenario: User follows normal Quantex skill installation

- **WHEN** a user wants a skill for operating Quantex from an external agent runtime
- **THEN** the documented default target is `quantex-cli`
- **AND** the user is not instructed to install `quantex-agent-runtime` unless they are contributing to this repository

### Requirement: Active agent-support docs MUST stay aligned with catalog and backlog tracking

Quantex SHALL keep active agent-support Markdown surfaces and their top-level GitHub backlog tracker aligned with the current supported catalog and support-matrix policy. Historical archives MAY preserve point-in-time state and MUST NOT be silently rewritten as current-state support docs.

#### Scenario: Maintainer updates supported-agent docs

- **GIVEN** a supported agent is added, renamed, or removed in `src/agents/catalog/*.json`
- **WHEN** active docs or skill references enumerate supported agent names or shortcuts
- **THEN** `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, and `skills/quantex-cli/references/command-recipes.md` reflect the current catalog entries or explicitly point readers to live CLI discovery commands for exact support
- **AND** the maintained snapshot does not omit known supported agents

#### Scenario: Maintainer reviews the top-level backlog issue

- **GIVEN** GitHub issue `#134` is the active top-level tracking issue for agent-catalog expansion
- **WHEN** a candidate moves into supported, active implementation, or exclusion
- **THEN** the issue keeps planning-only triage separate from repo-native source-of-truth docs and catalog files
- **AND** delivered candidates remain visible in their original triage bucket or a documented delivered section so backlog history stays meaningful
- **AND** `docs/agent-support-matrix.md` points unsupported backlog triage at issue `#134` or an explicitly named successor issue

#### Scenario: Agent syncs current docs without rewriting history

- **GIVEN** archived OpenSpec changes, session summaries, postmortems, or files under `docs/archive/`
- **WHEN** an agent is asked to update the current Markdown docs
- **THEN** the agent updates active docs and live tracking artifacts first
- **AND** historical records remain point-in-time snapshots unless the task explicitly asks to correct historical data

### Requirement: Umbrella changes MUST remain active across milestone delivery

Quantex SHALL permit a large OpenSpec umbrella change to be delivered through multiple reviewed milestone pull requests without treating an intermediate merge as archive eligibility. Each milestone merge MUST report its own validation, PR, and merge closure while the umbrella change remains active until every contracted task and final delivery condition is genuinely complete.

#### Scenario: One umbrella milestone merges

- **GIVEN** an active umbrella change is delivered through multiple milestones
- **WHEN** one milestone pull request merges to its protected target
- **THEN** the milestone MUST report merge closure without reporting umbrella archive closure
- **AND** the umbrella task counter MUST change only for work actually completed
- **AND** the umbrella change MUST remain active until its final completion and promotion conditions pass

### Requirement: Archive closure MUST follow implementation, promotion, teardown, and spec synchronization

Implementation completion, final promotion, product release, temporary delivery teardown, current-spec synchronization, and OpenSpec archive closure SHALL be treated as separate lifecycle states. A completed change MUST NOT be archived until its implementation is present on the protected target, temporary delivery infrastructure is no longer required, and accepted durable deltas are synchronized into current specs.

#### Scenario: A promoted umbrella change still has closure work

- **GIVEN** an umbrella implementation has reached its protected target
- **WHEN** release, temporary delivery cleanup, or current-spec synchronization remains pending
- **THEN** promotion merge closure MUST be reported separately
- **AND** the OpenSpec change MUST remain active until the pending closure work completes

#### Scenario: Agent-driven archive follow-up runs

- **GIVEN** implementation, required release handling, temporary delivery teardown, and current-spec synchronization are complete
- **WHEN** the agent-driven archive follow-up runs
- **THEN** it MUST archive the completed changes through the normal protected-branch delivery path
- **AND** it MUST validate and report the resulting active/archive state after the archive PR merges

### Requirement: Archive readiness MUST be based on actual task progress

Repo-native archive guardrails MUST read OpenSpec apply-instruction task progress and reject archive execution unless `complete` equals `total` and `remaining` is zero. A readiness task MAY record exact resumable commands and post-merge verification before archive execution, but readiness MUST NOT be reported as the archive action or result itself.

#### Scenario: Artifacts are complete but tasks remain

- **GIVEN** an OpenSpec change has all proposal artifacts but one or more tasks remain incomplete
- **WHEN** archive closure is requested
- **THEN** the archive guardrail MUST reject the request
- **AND** artifact completeness MUST NOT substitute for task completion

#### Scenario: Archive execution was prepared but not merged

- **GIVEN** exact archive commands, a validated PR body, and post-merge verification are ready
- **WHEN** the archive PR has not yet merged
- **THEN** the change MAY report archive readiness
- **AND** it MUST NOT report archive closure until the prepared commands run, the PR merges, and the resulting state is verified
