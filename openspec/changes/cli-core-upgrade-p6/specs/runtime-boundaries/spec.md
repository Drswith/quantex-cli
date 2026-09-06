## ADDED Requirements

### Requirement: CLI upgrade SHALL remain a thin facade over Core self-upgrade

Quantex SHALL keep CLI `upgrade` as a thin compatibility shell: it MAY parse
argv including frozen `--check` / `--channel`, bind CLI cancellation and
invocation context, invoke the in-repo Core self-upgrade engine, project Core
outcomes into maintained v1 human/JSON results, and apply exit policy. It MUST
NOT become a second self-upgrade planner or mutator, MUST NOT re-wrap a
published SDK `upgrade()` surface, and MUST NOT fold Quantex self-upgrade into
the agent-lifecycle update engine. JSON MUST still omit engine and route.

#### Scenario: Upgrade command module stays presentation-focused

- **WHEN** a user invokes `upgrade` or `qtx upgrade`
- **THEN** plan/check/apply ownership executes through the in-repo Core
  self-upgrade engine
- **AND THEN** the command module projects the outcome into the maintained v1
  CLI result without owning a second planning or mutation state machine

#### Scenario: Structured upgrade output omits engine and route identifiers

- **WHEN** `upgrade` emits JSON
- **THEN** the maintained payload does not include selected engine or route
  identifiers
- **AND THEN** engine or route diagnostics remain absent from those payloads
