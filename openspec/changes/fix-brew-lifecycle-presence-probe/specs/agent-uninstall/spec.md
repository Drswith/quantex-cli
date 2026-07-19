## MODIFIED Requirements

### Requirement: Uninstall planning MUST reconcile receipt, provider, and live executable evidence

Before choosing an uninstall action, Quantex MUST reconcile the recorded lifecycle receipt, presence evidence from the receipt's bound provider and package identity, and live executable evidence from the declared executable probe or `PATH`. A receipt SHALL be treated as source evidence rather than proof of current installation, and executable presence alone MUST NOT authorize a provider uninstall for an unproven package identity.

#### Scenario: Receipt and provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds an npm provider and package identity
- **AND** the npm presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes npm uninstall for the package bound by the receipt
- **AND** it does not substitute a package or provider from another install candidate

#### Scenario: Receipt and brew provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds a brew provider and formula or cask identity
- **AND** the brew presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes brew uninstall for the package bound by the receipt
- **AND** it does not treat brew observation as permanently indeterminate

#### Scenario: PATH-only detection does not establish managed ownership

- **GIVEN** an agent executable is present in `PATH`
- **AND** Quantex has no receipt or provider evidence that binds it to a managed package identity
- **WHEN** Quantex plans the uninstall
- **THEN** Quantex does not invoke any candidate provider's uninstall operation
- **AND** it classifies the live executable as unmanaged or untracked

#### Scenario: Inconclusive provider evidence fails closed

- **GIVEN** an agent receipt identifies a managed provider and package
- **AND** the provider presence probe cannot determine whether that package is present or absent
- **WHEN** Quantex plans the uninstall
- **THEN** Quantex does not discard the receipt or guess another provider
- **AND** it returns a failure or inconclusive result without claiming managed removal
