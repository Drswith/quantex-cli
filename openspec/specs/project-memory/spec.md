# Project Memory Specification

## Purpose

Define how Quantex stores durable discussion outcomes, operational knowledge, and agent-executable work inside the repository.

## Requirements

### Requirement: Repo-native canonical memory

The project SHALL store long-lived project memory in versioned repository artifacts instead of relying on session memory alone.

#### Scenario: Choosing where to write durable knowledge

- GIVEN a contributor or agent needs to record a durable outcome from a discussion
- WHEN the information is design rationale, a runbook, a postmortem, a session summary, or a task contract
- THEN the contributor writes it into the canonical directory defined in `docs/README.md`
- AND does not create a new root-level ad hoc markdown file for that category

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

### Requirement: Agent work must use explicit task contracts

The project SHALL define future autonomous work using bounded task contracts.

#### Scenario: Adding work for future agent execution

- GIVEN a follow-up item is intended for future execution by an agent
- WHEN it is added to the backlog
- THEN it has a task file in `autonomy/tasks/`
- AND the task includes scope, dependencies, done criteria, and required checks

### Requirement: Canonical docs must stay aligned with implementation

When implementation changes behavior, risk handling, or durable process, the corresponding project memory artifact SHALL be updated in the same change set or explicitly flagged for follow-up.

#### Scenario: Implementation reveals a new recurring recovery pattern

- GIVEN a change uncovers a reusable troubleshooting or recovery procedure
- WHEN the work is finalized
- THEN the relevant runbook is updated in the same change set
- OR a follow-up task captures the missing documentation work
