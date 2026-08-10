## ADDED Requirements

### Requirement: Install-source evidence MUST describe the evidence Quantex holds

Human-readable install-source evidence SHALL describe what Quantex actually observed about an agent's origin. It MUST NOT name a resolution mechanism that Quantex did not use to locate the executable, and MUST NOT contradict the resolved executable path reported alongside it. When Quantex has no tracked install record for an agent whose executable it resolved, the source evidence SHALL report that the executable was detected on disk without attributing it to `PATH`.

#### Scenario: Untracked agent resolves only in a known install directory

- **GIVEN** an agent executable exists in a known install directory that is absent from the inherited `PATH`
- **AND** Quantex holds no install record for that agent
- **WHEN** a user runs a human-readable detail, resolution, inventory, or diagnostic command for that agent
- **THEN** the rendered source evidence reports the executable as detected on disk
- **AND** the rendered source evidence does not claim the executable was found in `PATH`

#### Scenario: Untracked agent resolves through PATH

- **GIVEN** an agent executable resolves through the inherited `PATH`
- **AND** Quantex holds no install record for that agent
- **WHEN** a user runs a human-readable detail, resolution, inventory, or diagnostic command for that agent
- **THEN** the rendered source evidence reports the executable as detected on disk
- **AND** the source evidence is identical to the evidence rendered for an agent resolved from a known install directory

#### Scenario: Tracked agent source evidence is unaffected

- **GIVEN** Quantex holds an install record for an agent
- **WHEN** a user runs a human-readable command that renders source evidence
- **THEN** the evidence continues to name the recorded install source

#### Scenario: Inventory source column for an untracked agent

- **WHEN** the human `list` Source column is rendered for an installed agent with no tracked install record
- **THEN** the column reports the agent as detected
- **AND** the column does not report `PATH` as the source

### Requirement: Untracked-agent guidance MUST NOT assert PATH membership

Warnings and hints that tell a user an agent is present but unmanaged SHALL describe the agent as detected rather than as present in `PATH`, so the guidance does not send a user to inspect a `PATH` that never contained the executable. Diagnostics about a package manager's own `PATH` membership are unaffected and MAY continue to reference `PATH` directly.

#### Scenario: Diagnostics warn about an untracked agent

- **GIVEN** Quantex resolves an agent executable it does not track
- **WHEN** Quantex emits its untracked-install diagnostic warning
- **THEN** the message describes the agent as detected but not tracked as a managed Quantex install
- **AND** the message does not assert that the agent is available in `PATH`

#### Scenario: Bulk update reports an untracked agent

- **GIVEN** a bulk update encounters an agent Quantex resolves but does not track
- **WHEN** Quantex emits the untracked-agent hint for that agent
- **THEN** the hint describes the agent as detected but not tracked
- **AND** the hint does not assert that the agent is available in `PATH`

#### Scenario: A tracked package manager is genuinely missing from PATH

- **GIVEN** Quantex is recorded as installed through a package manager
- **AND** that package manager's own executable does not resolve through `PATH`
- **WHEN** Quantex emits the missing-installer diagnostic
- **THEN** the message continues to state that the package manager is not available in `PATH`
