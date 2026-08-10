## ADDED Requirements

### Requirement: Mutation failures expose the typed failure reason

Quantex MUST expose the underlying typed failure reason, and any provider-supplied remediation, on every non-success lifecycle mutation result. A failure result MUST NOT reduce to a generic message that omits evidence Quantex already holds.

The exposed reason is diagnostic payload. Quantex MUST NOT branch reconciliation, routing, or compensation on its text, so this requirement does not weaken the typed-outcome rule in "Provider outcomes are typed".

#### Scenario: No provider is available for the platform

- **GIVEN** every installation provider declared for an agent on the current platform reports itself unavailable
- **WHEN** Quantex fails the install
- **THEN** the structured failure carries the resolver's reason naming each unavailable provider, and the human failure line states it

#### Scenario: The provider command exits non-zero

- **GIVEN** a selected provider runs an install command that exits non-zero
- **WHEN** Quantex fails the install
- **THEN** the structured failure carries the provider description and its exit code

#### Scenario: Provider remediation survives to the caller

- **GIVEN** a failing resolution carries provider-supplied remediation
- **WHEN** Quantex reports the failure
- **THEN** the remediation is present in the structured failure alongside the reason

#### Scenario: Stable error codes are unchanged

- **GIVEN** a consumer keys on the failure's error code or on an existing lifecycle detail value
- **WHEN** a failure gains a diagnostic reason
- **THEN** the error code and existing lifecycle detail values are byte-identical to what the consumer received before

### Requirement: An undetermined decision is not reported as a verification failure

Quantex MUST distinguish a decide-phase outcome that could not determine the agent's state from a verification failure that follows an executed mutation. A failure that ran no mutation MUST NOT be reported as a failure to verify an installation.

#### Scenario: Decision cannot be determined before any mutation

- **GIVEN** the decide phase returns an indeterminate outcome and no install command has run
- **WHEN** Quantex reports the failure
- **THEN** the result identifies the failure as an undetermined decision, and does not claim the agent could not be verified after installation

#### Scenario: Verification failure after a real mutation is unchanged

- **GIVEN** an install command executed and post-execution verification did not confirm the agent
- **WHEN** Quantex reports the failure
- **THEN** the result continues to report a verification failure
