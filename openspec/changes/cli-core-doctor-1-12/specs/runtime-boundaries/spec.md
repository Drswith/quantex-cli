## ADDED Requirements

### Requirement: CLI doctor SHALL remain a thin facade over Core diagnosis

Quantex SHALL keep CLI `doctor` as a thin compatibility shell for the 1.12
doctor slice: it MAY gather CLI-coupled installer/self/agent observations
through a bridge, invoke the in-repo Core diagnosis engine, project Core
outcomes into maintained v1 human/JSON results, and apply exit policy. It MUST
NOT become a second diagnosis-engine implementation and MUST NOT re-wrap a
published SDK `doctor()` / `diagnose()` surface into a CLI-only API.

#### Scenario: Doctor command module stays presentation-focused

- **WHEN** a user invokes `doctor`
- **THEN** diagnosis ownership executes through the Core diagnosis engine behind
  the CLI bridge
- **AND THEN** the command path projects the outcome into the maintained v1 CLI
  result without owning a second issue-synthesis state machine

#### Scenario: Structured doctor output omits engine and route identifiers

- **WHEN** `doctor` emits JSON
- **THEN** the maintained payload does not include selected engine or route
  identifiers
- **AND THEN** engine or route diagnostics remain absent from those payloads
  (debug stderr only, when emitted)
