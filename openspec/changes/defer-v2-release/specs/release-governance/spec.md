## ADDED Requirements

### Requirement: Release PR validation enforces deferred-major readiness

Dedicated Release PR validation SHALL reject an ineligible deferred major version before it can merge into a protected release branch.

#### Scenario: release-please proposes v2 before the refactor window

- **WHEN** a generated stable Release PR proposes a v2 version before its readiness record is satisfied
- **THEN** PR Governance MUST fail the Release PR
- **AND** the candidate MUST remain unmergeable
