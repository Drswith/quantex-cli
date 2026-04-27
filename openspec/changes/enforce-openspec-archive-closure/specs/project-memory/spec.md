## ADDED Requirements

### Requirement: Completed OpenSpec changes MUST reach archive closure

When a non-trivial change is tracked in OpenSpec, the project SHALL treat implementation merge and archive closure as separate lifecycle moments, and SHALL close the change by archiving it after its accepted spec delta is synced.

#### Scenario: Completed change lands on a protected branch

- **WHEN** an OpenSpec-backed implementation PR merges to a protected branch such as `main` or `beta`
- **THEN** the project keeps the merged code as implemented work
- **AND** follows up by archiving the completed change instead of leaving it indefinitely under `openspec/changes/`

#### Scenario: Repository automation performs archive follow-up

- **WHEN** the repository detects completed active OpenSpec changes on a protected branch
- **THEN** it creates a follow-up archive PR rather than silently treating the change as already closed
- **AND** that PR syncs spec changes and moves the completed change into `openspec/changes/archive/`
