## ADDED Requirements

### Requirement: Uninstall evidence reconciliation MUST apply the agent's default executable name

When comparing the provider binding derived from installed-agent state against the provider binding derived from the lifecycle receipt, Quantex MUST resolve an absent executable name on either side to the agent's declared `binaryName` before deciding whether the two records identify the same source. Recorded evidence that agrees on provider, target identity, and target kind, and differs only by whether the agent's default executable name is spelled out, SHALL NOT be classified as a conflicting source. Quantex MUST still classify a receipt that names a genuinely different executable as a conflicting source.

#### Scenario: Receipt names the agent's default executable and state omits it

- **GIVEN** an agent has installed-agent state for a package provider that records no executable name
- **AND** the lifecycle receipt for that agent binds the same provider, target identity, and target kind
- **AND** the receipt's executable name equals the agent's declared `binaryName`
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex treats the two records as the same source
- **AND** it proceeds to managed uninstall reconciliation instead of returning a `conflicting-source` failure

#### Scenario: State names the agent's default executable and the receipt omits it

- **GIVEN** an agent has installed-agent state whose recorded executable name equals the agent's declared `binaryName`
- **AND** the lifecycle receipt binds the same provider, target identity, and target kind but records no executable name
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex treats the two records as the same source
- **AND** it proceeds to managed uninstall reconciliation instead of returning a `conflicting-source` failure

#### Scenario: Receipt names a different executable

- **GIVEN** an agent has installed-agent state for a package provider
- **AND** the lifecycle receipt binds the same provider and target identity
- **AND** the receipt's executable name differs from both the recorded state executable name and the agent's declared `binaryName`
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex returns the `conflicting-source` uninstall failure
- **AND** it does not invoke provider uninstall
