## ADDED Requirements

### Requirement: Uninstall lifecycle extraction MUST preserve published behavior

Quantex MUST preserve the existing `uninstall` action, target, data fields, warnings, error codes, error details, exit behavior, and persisted-state semantics while moving command-neutral uninstall decisions behind a service boundary.

#### Scenario: Unknown agent remains unchanged

- **WHEN** uninstall receives an unknown agent name
- **THEN** Quantex returns the existing `AGENT_NOT_FOUND` result and input details

#### Scenario: Unmanaged install remains protected

- **WHEN** the target agent has no recorded Quantex install state
- **THEN** Quantex returns `UNINSTALL_UNMANAGED`
- **AND** does not invoke automatic uninstall

#### Scenario: Dry run remains non-mutating

- **WHEN** a managed target is uninstalled in dry-run mode
- **THEN** Quantex returns the existing successful `DRY_RUN` result
- **AND** does not invoke automatic uninstall

#### Scenario: Managed uninstall preserves success and failure

- **WHEN** the existing package-manager uninstall operation succeeds or fails
- **THEN** Quantex preserves the existing success data or `UNINSTALL_FAILED` result

#### Scenario: Lifecycle lock remains structured

- **WHEN** uninstall cannot acquire the lifecycle lock
- **THEN** Quantex returns the existing `RESOURCE_LOCKED` result and resource details

### Requirement: Command output MUST remain outside the uninstall lifecycle service

The uninstall lifecycle service MUST return command-neutral outcomes, while `uninstallCommand` remains responsible for public result construction, messages, exit behavior, and human rendering.

#### Scenario: Command maps service outcome

- **WHEN** the uninstall service returns a terminal lifecycle outcome
- **THEN** `uninstallCommand` maps it to the existing public contract without exposing internal service types
