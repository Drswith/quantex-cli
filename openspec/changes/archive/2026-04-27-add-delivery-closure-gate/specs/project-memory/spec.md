## ADDED Requirements

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
- **AND** the agent MUST identify whether archive closure is pending, already complete, or delegated to repository automation

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
