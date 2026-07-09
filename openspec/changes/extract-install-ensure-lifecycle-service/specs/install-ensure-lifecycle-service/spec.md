## ADDED Requirements

### Requirement: Install and ensure MUST preserve their published contracts during lifecycle service extraction

Quantex MUST preserve the existing single-agent `install` and `ensure` command actions, targets, data fields, warnings, error codes, events, exit behavior, and persisted install state while their shared lifecycle decisions move behind an internal service boundary.

#### Scenario: Unknown agent remains command-specific

- **WHEN** a caller invokes `install` or `ensure` with an unknown agent name
- **THEN** Quantex returns the existing command action and target
- **AND** returns the existing `AGENT_NOT_FOUND` error details

#### Scenario: Managed existing install remains a no-op

- **WHEN** the target agent is already available and has recorded Quantex install state
- **THEN** `install` and `ensure` return success with `changed: false` and `installed: true`
- **AND** preserve the `ALREADY_INSTALLED` warning
- **AND** do not run or track an installer

#### Scenario: Safely adoptable existing install remains trackable

- **WHEN** the target agent is already available without recorded state
- **AND** its supported install source can be safely identified
- **THEN** a normal `install` or `ensure` invocation records the existing install state
- **AND** preserves the `TRACKED_EXISTING_INSTALL` warning and install-state data

#### Scenario: Ambiguous existing install remains unmanaged

- **WHEN** the target agent is already available without recorded state
- **AND** Quantex cannot safely identify one supported install source
- **THEN** `install` and `ensure` return success without changing state
- **AND** preserve the `UNTRACKED_EXISTING_INSTALL` warning

#### Scenario: Dry run remains non-mutating

- **WHEN** `install` or `ensure` is invoked in dry-run mode for an adoptable or missing agent
- **THEN** Quantex preserves the existing successful dry-run result and `DRY_RUN` warning
- **AND** does not track state or run an installer

#### Scenario: Missing agent uses the existing installation behavior

- **WHEN** the target agent is not available and the invocation is not a dry run
- **THEN** `install` and `ensure` use the existing install-method ordering and fallback behavior
- **AND** preserve the existing success data or `INSTALL_FAILED` result

### Requirement: Shared lifecycle extraction MUST preserve cancellation and lock behavior

Quantex MUST preserve the existing cancellation and lifecycle lock behavior of the single-agent `install` and `ensure` commands while centralizing their shared inspection and mutation decisions.

#### Scenario: Tracking cancellation preserves command action

- **WHEN** tracking an adopted existing install is cancelled before state persistence completes
- **THEN** Quantex returns the existing `CANCELLED` result
- **AND** the result retains the invoked `install` or `ensure` action and command-specific message

#### Scenario: Lifecycle lock failure preserves structured details

- **WHEN** tracking or installation cannot acquire the lifecycle lock
- **THEN** Quantex returns the existing `RESOURCE_LOCKED` error code and details
- **AND** preserves whether the agent was already available in the command data

#### Scenario: Unexpected failures continue to propagate

- **WHEN** inspection, tracking, or installation throws an error that is not a lifecycle lock error
- **THEN** the shared lifecycle boundary does not silently convert it into an install failure
- **AND** existing command-runtime error handling remains responsible for the terminal result

### Requirement: Command output MUST remain outside the shared lifecycle service

The shared install/ensure lifecycle service MUST return command-neutral lifecycle outcomes, while command handlers remain responsible for structured result construction, action names, warning and error messages, NDJSON event emission, batch aggregation, and human rendering.

#### Scenario: Install maps a shared outcome

- **WHEN** the shared service reports an install lifecycle outcome to `install`
- **THEN** the install command maps it to the existing `install` action, result shape, messages, and events

#### Scenario: Ensure maps a shared outcome

- **WHEN** the shared service reports the same lifecycle outcome to `ensure`
- **THEN** the ensure command maps it to the existing `ensure` action, result shape, messages, and events
