## ADDED Requirements

### Requirement: Successful empty uv tool inventories MUST be conclusive absence

Quantex MUST classify a uv tool package as absent when `uv tool list` exits successfully and emits the explicit `No tools installed` marker with no tool entries. The legacy and Core presence probes MUST apply the same rule. Empty or unparseable output without that successful marker MUST remain unknown or indeterminate so mutation routing still fails closed.

#### Scenario: Fresh uv tool directory is empty

- **GIVEN** uv is available and no uv tools are installed
- **WHEN** `uv tool list` exits zero with no tool entries and emits `No tools installed`
- **THEN** Quantex conclusively observes the requested uv package as absent
- **AND** a fresh install may proceed through normal lifecycle reconciliation

#### Scenario: Empty uv output is unexplained

- **WHEN** `uv tool list` has empty or unparseable output without the successful `No tools installed` marker
- **THEN** Quantex keeps package presence unknown or indeterminate
- **AND** it does not authorize a mutation from guessed absence
