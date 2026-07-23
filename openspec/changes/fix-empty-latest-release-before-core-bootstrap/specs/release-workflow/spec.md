## ADDED Requirements

### Requirement: Core bootstrap MUST precede public GitHub Release creation

When a publish-mode Release run requires the Core package, the Release workflow SHALL validate Core npm ownership and trusted-publishing bootstrap before Release Please creates or refreshes the public GitHub Release for that version. Incomplete bootstrap MUST fail closed with an actionable diagnostic and MUST NOT create or refresh that public GitHub Release in the same invocation.

#### Scenario: Core bootstrap is incomplete before GitHub Release creation

- **GIVEN** the selected release commit requires the Core package
- **AND** Core npm trusted publishing is not marked ready, or the Core package does not yet exist for first-time trusted-publisher bootstrap
- **WHEN** a publish-mode Release run evaluates Core bootstrap
- **THEN** the workflow MUST fail with an actionable bootstrap diagnostic
- **AND** it MUST NOT create or refresh the public GitHub Release in that invocation
- **AND** it MUST NOT publish either repository-owned npm package in that invocation

#### Scenario: Core bootstrap is ready before GitHub Release creation

- **GIVEN** the selected release commit requires the Core package
- **AND** Core npm trusted publishing is marked ready
- **AND** the Core package identity already exists on the registry
- **WHEN** a publish-mode Release run evaluates Core bootstrap
- **THEN** the workflow MAY create or refresh the public GitHub Release
- **AND** it MUST still publish or verify Core before CLI and MUST upload standalone artifacts only after repository npm closure
