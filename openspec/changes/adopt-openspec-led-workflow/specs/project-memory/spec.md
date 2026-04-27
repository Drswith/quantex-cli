# Project Memory Delta

## Modified Requirements

### Requirement: Non-trivial changes MUST use OpenSpec as the proposal contract

The project SHALL use OpenSpec-compatible change folders as the default proposal and task contract for non-trivial behavior or durable-process changes.

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

The project SHALL avoid growing project-specific workflow commands when an OpenSpec-compatible artifact or GitHub-native workflow can provide the same planning and review capability.

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
