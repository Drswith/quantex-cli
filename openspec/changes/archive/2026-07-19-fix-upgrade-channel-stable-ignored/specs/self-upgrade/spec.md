## MODIFIED Requirements

### Requirement: Self-upgrade MAY support explicit channel and check flows

The self-upgrade surface SHALL support explicit user-controlled update checks and channel selection.

When the user supplies `--channel stable` or `--channel beta`, Quantex MUST treat that value as the requested update channel and MUST NOT replace it with env or config defaults.

#### Scenario: User performs an explicit check

- GIVEN the user runs `quantex upgrade --check`
- WHEN Quantex evaluates whether a newer version exists
- THEN it checks for availability without performing the upgrade

#### Scenario: User selects a non-default channel

- GIVEN the user runs `quantex upgrade --channel beta`
- WHEN Quantex checks for or performs self-upgrade
- THEN it uses the selected channel instead of the default channel

#### Scenario: Explicit stable overrides configured beta

- GIVEN config `selfUpdateChannel` or env `QUANTEX_UPDATE_CHANNEL` is `beta`
- AND the user runs `quantex upgrade --channel stable` or `quantex upgrade --channel stable --check`
- WHEN Quantex resolves the update channel
- THEN it uses `stable` instead of the configured or env beta channel
