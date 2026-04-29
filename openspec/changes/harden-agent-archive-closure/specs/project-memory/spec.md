## ADDED Requirements

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
