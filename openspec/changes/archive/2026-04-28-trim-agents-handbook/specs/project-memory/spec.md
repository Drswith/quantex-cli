## ADDED Requirements

### Requirement: AGENTS.md MUST stay a thin execution handbook

The repository SHALL keep `AGENTS.md` as a thin but self-contained execution handbook for coding agents. The file SHALL inline only the mission, non-goals, quickstart, hard constraints, validation triggers, intake and closure gates, file-scoped red lines, and trigger-based pointers needed to route detailed knowledge.

#### Scenario: Agent starts a repository session

- **WHEN** a coding agent reads `AGENTS.md` at the start of repository work
- **THEN** the file exposes the hard execution constraints without requiring another document to understand the guardrails
- **AND** the file does not depend on copied source trees, copied type definitions, or full command catalogs to remain useful

### Requirement: AGENTS.md pointers MUST route volatile details to source-of-truth artifacts

Drift-prone details referenced by `AGENTS.md` SHALL live in source-of-truth code, docs, or discovery commands and SHALL be reached through trigger-based pointers.

#### Scenario: Agent needs current source details

- **WHEN** the current task depends on up-to-date type definitions, command catalogs, schema surfaces, release workflow details, or architecture boundaries
- **THEN** `AGENTS.md` points the agent to the relevant source file, canonical doc, or discovery command
- **AND** the volatile detail is not duplicated inline inside `AGENTS.md`
