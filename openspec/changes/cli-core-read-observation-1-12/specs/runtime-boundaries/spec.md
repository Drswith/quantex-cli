## ADDED Requirements

### Requirement: CLI inspect, info, and resolve SHALL remain thin projectors over Core read observation

Quantex SHALL keep CLI `inspect`, `info`, and `resolve` as thin compatibility
shells for the 1.12 read-observation slice: they MAY parse argv, invoke in-repo
Core read observation, project Core outcomes into maintained v1 human/JSON/NDJSON
results, and apply exit policy. They MUST NOT become a second observation engine
implementation and MUST NOT re-wrap the published SDK `inspect()` surface into a
CLI-only API when the CLI contract is richer than the SDK type.

#### Scenario: Inspect or info command module stays presentation-focused

- **WHEN** a user invokes `inspect` or `info`
- **THEN** observation executes through the Core-backed CLI read adapter
- **AND THEN** the command module projects the observation into the maintained
  v1 CLI result without owning PATH probing or state reads outside that adapter

#### Scenario: Resolve command module stays presentation-focused

- **WHEN** a user invokes `resolve`
- **THEN** observation executes through the Core-backed CLI read adapter
- **AND THEN** the command module projects installed-path guidance or the
  maintained not-installed error contract without becoming a second observation
  engine
