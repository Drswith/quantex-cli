## ADDED Requirements

### Requirement: Explicit check and dry-run MUST preserve manual-required upgrades

When self-upgrade planning returns `manual-required` because the current install source cannot auto-update, `quantex upgrade --check` and dry-run SHALL emit the same structured `MANUAL_ACTION_REQUIRED` result used by normal `quantex upgrade`. They MUST NOT rewrite that plan into `check-unavailable` or `NETWORK_ERROR`.

#### Scenario: Explicit check on a non-auto-update install source

- **GIVEN** self-upgrade planning returns `status: 'manual-required'`
- **AND** the install source cannot auto-update (for example `source`)
- **WHEN** the user runs `quantex upgrade --check`
- **THEN** Quantex MUST report structured `MANUAL_ACTION_REQUIRED`
- **AND** the result data status MUST be `manual-required`
- **AND** it MUST NOT claim the latest version could not be determined solely because auto-update is unavailable

#### Scenario: Dry-run on a non-auto-update install source

- **GIVEN** self-upgrade planning returns `status: 'manual-required'`
- **WHEN** the user runs `quantex upgrade` with dry-run enabled
- **THEN** Quantex MUST report structured `MANUAL_ACTION_REQUIRED`
- **AND** it MUST NOT rewrite the result into `NETWORK_ERROR` / `check-unavailable`
