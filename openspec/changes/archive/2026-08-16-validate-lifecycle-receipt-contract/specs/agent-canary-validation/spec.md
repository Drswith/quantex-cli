## ADDED Requirements

### Requirement: Real package-provider update coverage MUST exercise a receipt-writing upgrade

The real-agent lifecycle smoke MUST include a disposable package-provider scenario that seeds a selected smoke agent at a valid stable version lower than the registry's current `latest`, adopts that installation through Quantex, and runs `qtx update` with refreshed version metadata. The scenario MUST require an `updated` result, verify that the update-written lifecycle receipt is present, and pass that receipt directly into the following `qtx uninstall` operation. A missing predecessor version, unavailable registry, no-op update, or failed receipt-consuming uninstall MUST fail the canary rather than be reported as skipped coverage.

#### Scenario: Quick canary reaches the managed update receipt branch

- **GIVEN** the quick matrix selects the `opencode` Bun package provider in a fresh disposable HOME
- **WHEN** the lifecycle probe resolves a stable package version below the current registry `latest`, installs that version, and asks Quantex to adopt it
- **THEN** `qtx update` MUST report an actual `updated` result after refreshing version metadata
- **AND** the persisted lifecycle receipt MUST contain the agent's executable name
- **AND** the subsequent `qtx uninstall opencode` MUST succeed and remove the installation

#### Scenario: Upgrade evidence cannot be downgraded to a no-op pass

- **GIVEN** the selected package has no valid lower stable SemVer or its registry metadata cannot be read
- **WHEN** the real-upgrade scenario prepares its seeded installation
- **THEN** the canary MUST fail with the package/registry reason
- **AND** it MUST NOT claim successful lifecycle coverage from an `up-to-date` result

### Requirement: Lifecycle receipt writers MUST remain compatible with uninstall readers for every provider type

The repository contract suite MUST capture the receipt emitted by each lifecycle receipt writer—the legacy install engine, the Core install engine, and the managed update path—for every provider in the first-party provider registry. For each captured receipt, the suite MUST resolve the corresponding installed-state and receipt bindings and assert that the uninstall reconciliation comparator accepts matching provider, target identity, target kind, and the agent's default executable name. The suite MUST continue to reject a genuinely different executable name as a source conflict.

#### Scenario: Package-provider install and update shapes reconcile

- **GIVEN** a package-provider installed state omits its default executable name
- **WHEN** a legacy/Core install writer emits a receipt without that optional field and the update writer emits a receipt that includes it
- **THEN** both receipts MUST be accepted by the uninstall reader for the same provider target

#### Scenario: Explicit executable providers remain covered

- **GIVEN** a deno, script, or binary provider state records an explicit executable identity
- **WHEN** each install and update writer emits its receipt
- **THEN** the receipt MUST reconcile with the installed-state binding without losing the explicit executable identity

#### Scenario: A genuinely different executable remains a conflict

- **GIVEN** a receipt names an executable different from the agent's declared default and the installed-state binding
- **WHEN** the uninstall reader compares the two bindings
- **THEN** the contract test MUST fail that comparison as a conflicting source
