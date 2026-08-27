## ADDED Requirements

### Requirement: Installs bound to a superseded package MUST report migration instead of a version comparison

When a recorded install's package identity matches a superseded identifier declared by the agent's catalog entry, Quantex MUST treat the available target version as unresolved for that installation. Quantex MUST NOT query the superseded identifier for a target version, MUST NOT compare the installed version against a version resolved from it, and MUST NOT report the installation as up-to-date on that basis. Update planning SHALL return a manual outcome that names the current package identifier and the commands that move the installation onto it.

This condition is distinct from conflicting live evidence: the recorded package can still be genuinely installed and internally consistent with every live probe. What makes it unsafe is that the identifier no longer receives upstream releases, so a version resolved from it describes an abandoned distribution rather than the agent's current one.

#### Scenario: Resolving a target version for an install bound to a superseded package

- **GIVEN** a recorded managed install whose package identity is declared superseded by the agent's catalog entry
- **WHEN** Quantex resolves that agent's available target version
- **THEN** Quantex reports no target version for the installation
- **AND** it does not query the superseded identifier for a latest version
- **AND** it does not substitute the current package identifier as though it were the recorded one

#### Scenario: Planning an update for an install bound to a superseded package

- **GIVEN** a recorded managed install whose package identity is declared superseded
- **AND** live provider evidence agrees with the recorded package
- **WHEN** Quantex plans an update for that agent
- **THEN** Quantex does not report the installation as up-to-date
- **AND** the outcome requires manual action and names the current package identifier
- **AND** the result carries a warning identifying the recorded package, the current package, and the uninstall and install commands that complete the migration

#### Scenario: Install already bound to the current package

- **GIVEN** a recorded install whose package identity is the agent's current package identifier
- **WHEN** Quantex resolves the target version and plans an update for that agent
- **THEN** the entry's superseded declaration does not affect resolution or planning
- **AND** Quantex plans the update from the current package identifier as usual

#### Scenario: Quantex does not migrate the installation automatically

- **GIVEN** a recorded managed install whose package identity is declared superseded
- **WHEN** Quantex plans or executes an update for that agent
- **THEN** Quantex does not uninstall the superseded package and does not install the current package on the user's behalf
- **AND** the reported migration remains an explicit user action
