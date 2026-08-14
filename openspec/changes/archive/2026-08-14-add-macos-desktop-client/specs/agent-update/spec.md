## ADDED Requirements

### Requirement: Managed-only batch update discovery MUST use recorded agent state

The update command SHALL support a managed-only batch scope that selects names
from persisted installed-agent state rather than the full catalog. This scope
MUST preserve recorded-source planning, include blocked or failed managed
observations in its result, and leave the existing `update --all` target set
unchanged.

#### Scenario: Planning managed agents without mutation

- **GIVEN** Quantex has persisted lifecycle state for one or more agents
- **WHEN** the user runs `quantex update --all --managed --dry-run --output json`
- **THEN** Quantex plans only those persisted agent names
- **AND** it does not execute an installer or self-update command
- **AND** the result includes each planned, blocked, or failed managed target

#### Scenario: Existing full batch behavior remains available

- **WHEN** the user runs `quantex update --all` without `--managed`
- **THEN** Quantex preserves its existing catalog-wide update behavior
