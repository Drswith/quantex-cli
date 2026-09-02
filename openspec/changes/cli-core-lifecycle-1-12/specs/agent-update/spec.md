## ADDED Requirements

### Requirement: CLI update SHALL execute through the in-repo Core engine by default

Quantex SHALL execute the maintained `update` command contract through the
in-repo Core update engine by default. The observable command names, options
(`--all`, `--managed`), structured result fields, exit-code meanings, PATH-only
external-agent preservation, and state identities MUST remain unchanged by the
engine relocation.

#### Scenario: Updating a managed agent after the Core relocation

- **GIVEN** an agent was installed through a managed package source
- **WHEN** the user runs `quantex update <agent>` without the legacy engine
  override
- **THEN** Quantex selects the Core update engine before mutation side effects
- **AND THEN** the structured success and failure contracts remain the
  maintained v1 update contracts
