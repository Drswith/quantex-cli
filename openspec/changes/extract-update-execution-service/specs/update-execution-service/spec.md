## ADDED Requirements

### Requirement: Update execution extraction MUST preserve published behavior

Quantex MUST preserve the existing `update` action, target, data fields, error codes, error details, progress ordering, exit behavior, and update semantics while moving command-neutral plan execution behind a service boundary.

#### Scenario: Existing classifications remain ordered

- **WHEN** an update plan contains up-to-date, skipped manual-check, or untracked-path entries
- **THEN** Quantex reports the existing result status, version fields, and guidance in the existing order

#### Scenario: Grouped update retains fallback behavior

- **WHEN** a managed package group succeeds
- **THEN** Quantex reports each grouped entry as updated
- **AND WHEN** the group operation returns failure
- **THEN** Quantex falls back to the existing per-agent update behavior

#### Scenario: Dry run remains non-mutating

- **WHEN** update execution runs in dry-run mode
- **THEN** Quantex reports the existing planned results
- **AND** does not invoke package-manager mutations

#### Scenario: Cancellation stops remaining work

- **WHEN** cancellation is observed between update operations
- **THEN** Quantex stops executing remaining grouped and manual entries
- **AND** preserves results already produced

#### Scenario: Lifecycle lock remains structured

- **WHEN** a grouped or individual update cannot acquire the lifecycle lock
- **THEN** Quantex preserves the existing locked status, message, strategy, and resource details

#### Scenario: Self-update remains verified

- **WHEN** a self-update operation succeeds
- **THEN** Quantex verifies the installed version using the existing version probe
- **AND** preserves the existing up-to-date or updated classification

### Requirement: Command output MUST remain outside the update execution service

The update execution service MUST return domain execution results and report progress through an optional callback, while `updateCommand` remains responsible for public result construction, NDJSON event construction, messages, error mapping, and human rendering.

#### Scenario: Command maps execution state

- **WHEN** the update execution service reports progress or returns terminal state
- **THEN** `updateCommand` maps it to the existing public events and result contract without exposing internal service options
