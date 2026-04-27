## ADDED Requirements

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
