## MODIFIED Requirements

### Requirement: Lifecycle receipt writers MUST remain compatible with uninstall readers for every provider type

The repository contract suite MUST capture the receipt emitted by each remaining
lifecycle receipt writer—the Core install engine and the managed update
path—for every provider in the first-party provider registry. For each captured
receipt, the suite MUST resolve the corresponding installed-state and receipt
bindings and assert that the uninstall reconciliation comparator accepts
matching provider, target identity, target kind, and the agent's default
executable name. The suite MUST continue to reject a genuinely different
executable name as a source conflict. After exec `--install` leaves the legacy
reconcile install writer, that writer MUST NOT remain a required contract
capture source.

#### Scenario: Package-provider install and update shapes reconcile

- **GIVEN** a package-provider installed state omits its default executable name
- **WHEN** a Core install writer emits a receipt without that optional field and
  the update writer emits a receipt that includes it
- **THEN** both receipts MUST be accepted by the uninstall reader for the same
  provider target

#### Scenario: Explicit executable providers remain covered

- **GIVEN** a deno, script, or binary provider state records an explicit
  executable identity
- **WHEN** each install and update writer emits its receipt
- **THEN** the receipt MUST reconcile with the installed-state binding without
  losing the explicit executable identity

#### Scenario: A genuinely different executable remains a conflict

- **GIVEN** a receipt names an executable different from the agent's declared
  default and the installed-state binding
- **WHEN** the uninstall reader compares the two bindings
- **THEN** the contract test MUST fail that comparison as a conflicting source
