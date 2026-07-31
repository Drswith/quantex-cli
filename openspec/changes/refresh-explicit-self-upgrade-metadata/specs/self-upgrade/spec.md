## MODIFIED Requirements

### Requirement: Self-upgrade MAY support explicit channel and check flows

The self-upgrade surface SHALL support explicit user-controlled update checks and channel selection. An explicit self-upgrade check or execution SHALL refresh self-upgrade version metadata before evaluating availability, even when a cache entry remains within its normal TTL.

#### Scenario: User performs an explicit check

- GIVEN the user runs `quantex upgrade --check`
- WHEN Quantex evaluates whether a newer version exists
- THEN it refreshes self-upgrade version metadata before checking availability
- AND it checks for availability without performing the upgrade

#### Scenario: User performs a direct upgrade

- GIVEN the user runs `quantex upgrade`
- WHEN Quantex evaluates whether a newer version exists before execution
- THEN it refreshes self-upgrade version metadata before selecting an update target

#### Scenario: User selects a non-default channel

- GIVEN the user runs `quantex upgrade --channel beta`
- WHEN Quantex checks for or performs self-upgrade
- THEN it refreshes version metadata for the selected channel
- AND it uses the selected channel instead of the default channel
