## ADDED Requirements

### Requirement: Deferred-major readiness is checked before release sealing

The Release seal contract SHALL evaluate deferred-major readiness before creating or verifying a tag and before dispatching publication.

#### Scenario: manual seal targets an ineligible v2 candidate

- **WHEN** a maintainer dispatches Seal Release for a v2 candidate without a satisfied readiness record
- **THEN** the workflow MUST fail before tag mutation or Release workflow dispatch
