## MODIFIED Requirements

### Requirement: Supported agent catalog entries MUST stay lifecycle-focused

Quantex SHALL keep supported agent catalog metadata scoped to values that directly support installation, inspection, resolution, execution, update planning, and stable machine-readable contracts.

#### Scenario: Resolving a displayed agent name

- GIVEN a supported agent entry has a `displayName`
- WHEN a lifecycle command receives that display name as its agent input
- THEN Quantex resolves the input to the same supported agent as the canonical name
- AND canonical names and lookup aliases remain valid lookup keys
