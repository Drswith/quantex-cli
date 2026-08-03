## ADDED Requirements

### Requirement: Managed update MUST accept equivalent executable path evidence

Agent update planning MUST allow a tracked managed install to use its recorded provider when the receipt path, provider-reported path, and live path identify the same executable after canonical resolution.

#### Scenario: Legacy shim receipt proceeds to managed update planning

- **GIVEN** an agent has tracked managed install state and a lifecycle receipt containing a package-manager shim path
- **AND** live observation resolves the shim to the same executable reported by the recorded provider
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex does not fail with an update-source conflict solely because the stored and resolved path strings differ
- **AND** it proceeds through the normal recorded-provider update decision
