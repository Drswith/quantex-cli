## MODIFIED Requirements

### Requirement: Executable path evidence MUST compare canonical identities

Lifecycle observation MUST compare recorded, provider-reported, and live executable paths by canonical filesystem identity before classifying them as conflicting source evidence.

A lifecycle receipt's recorded executable path is evidence for the version that receipt recorded. When live observation reports a version that is semantically different from the receipt's recorded version, Quantex MUST NOT derive source drift from the receipt's recorded path, because an installer that relocates its executable between releases makes that path stale by construction.

When the recorded target kind is `script` or `binary`, Quantex MUST still derive source drift from the receipt's recorded path when the recorded and live versions agree, and when either version is unknown.

When the recorded target kind is not `script` or `binary`, and the bound provider observation confirms that same target is present, Quantex MUST NOT derive source drift solely from a receipt executable path that differs from PATH. Provider-reported and live executable paths are both live evidence and MUST continue to be compared regardless of version.

#### Scenario: Symbolic link and target identify the same executable

- **GIVEN** a lifecycle receipt records a symbolic-link or package-manager shim path
- **AND** live observation resolves that path to its canonical target
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex treats the paths as consistent when both resolve to the same filesystem identity
- **AND** it does not report source drift solely because the path strings differ

#### Scenario: Distinct executable targets at the recorded version remain conflicting

- **GIVEN** the recorded target kind is `script` or `binary`
- **AND** recorded and live executable paths resolve to different filesystem identities
- **AND** the receipt's recorded version and the live observed version are the same
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation

#### Scenario: Relocated executable at a moved-on version is not source drift

- **GIVEN** a lifecycle receipt records an executable path under a version-specific install directory
- **AND** live observation resolves the agent's executable to a different path under a different version-specific install directory
- **AND** the live observed version is semantically different from the receipt's recorded version
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex does not report source drift from the recorded path
- **AND** the observation remains eligible for update planning and post-mutation verification

#### Scenario: Unknown version keeps the conservative path comparison

- **GIVEN** the recorded target kind is `script` or `binary`
- **AND** recorded and live executable paths resolve to different filesystem identities
- **AND** either the receipt's recorded version or the live observed version is unavailable
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation

#### Scenario: A recorded package provider still matches after PATH relocates

- **GIVEN** a lifecycle receipt identifies a bun or npm package target
- **AND** the bound provider presence probe confirms that package is present
- **AND** the provider observation does not report a conflicting executable path
- **AND** PATH resolves a different executable path at a compatible or unknown version
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex does not report conflicting source evidence from the receipt path alone
- **AND** the observation remains eligible for update planning against the recorded package identity

#### Scenario: Provider-reported live path still conflicts regardless of version

- **GIVEN** the bound provider observation reports present with an executable path
- **AND** that path and the live PATH executable resolve to different filesystem identities
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation
