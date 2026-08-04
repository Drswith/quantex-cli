## ADDED Requirements

### Requirement: Deferred major releases require an explicit readiness record

The repository SHALL deny a deferred stable major release by default. The temporary v2 gate MAY be removed only by a future reviewed OpenSpec change that documents the completed required refactor and evidence that at least 90 days have elapsed since it completed.

#### Scenario: v2 has no readiness record

- **WHEN** a generated stable Release PR proposes a v2 version
- **AND** the temporary v2 gate remains in effect
- **THEN** Release PR validation MUST fail
- **AND** sealing or publication MUST NOT proceed

#### Scenario: future refactor has not stabilized

- **WHEN** a future owner proposes removal of the v2 gate
- **AND** the required refactor is incomplete or fewer than 90 days have elapsed
- **THEN** Release PR validation and sealing MUST fail

#### Scenario: future refactor has stabilized

- **WHEN** a future OpenSpec change documents the completed required refactor and 90-day interval
- **THEN** that change MAY replace the temporary v2 gate with an auditable readiness mechanism
