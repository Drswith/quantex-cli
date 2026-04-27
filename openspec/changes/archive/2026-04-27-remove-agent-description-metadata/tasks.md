## 1. Catalog Contract

- [x] 1.1 Define an OpenSpec capability for lifecycle-focused agent catalog metadata.
- [x] 1.2 Record that localized descriptive prose is outside the required agent catalog contract.

## 2. Implementation

- [x] 2.1 Remove `description` from `AgentDefinition` and built-in agent entries.
- [x] 2.2 Remove `description` from `quantex info` and `quantex inspect` outputs.
- [x] 2.3 Update tests and repository-facing interface documentation to match the slimmer contract.

## 3. Validation

- [x] 3.1 Run lint, typecheck, and test after the contract change.
- [x] 3.2 Run OpenSpec validation for the new change.
