## ADDED Requirements

### Requirement: Executable path evidence MUST compare canonical identities

Lifecycle observation MUST compare recorded, provider-reported, and live executable paths by canonical filesystem identity before classifying them as conflicting source evidence.

#### Scenario: Symbolic link and target identify the same executable

- **GIVEN** a lifecycle receipt records a symbolic-link or package-manager shim path
- **AND** live observation resolves that path to its canonical target
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex treats the paths as consistent when both resolve to the same filesystem identity
- **AND** it does not report source drift solely because the path strings differ

#### Scenario: Distinct executable targets remain conflicting

- **GIVEN** recorded and live executable paths resolve to different filesystem identities
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation
