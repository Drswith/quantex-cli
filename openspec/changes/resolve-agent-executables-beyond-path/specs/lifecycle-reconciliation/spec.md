## ADDED Requirements

### Requirement: Agent executable resolution MUST consider known install directories

Quantex SHALL resolve an agent executable by first consulting the inherited `PATH` and, only when that lookup does not resolve, by consulting a deterministic set of known agent install directories derived from the environment and the home directory. A `PATH` hit MUST remain authoritative. Quantex MUST NOT modify the user's `PATH`, MUST NOT write to shell profiles, and MUST NOT search directories outside the known set.

#### Scenario: Executable resolves through PATH

- **GIVEN** an agent executable is reachable through the inherited `PATH`
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the path produced by the `PATH` lookup and does not consult the known install directories

#### Scenario: Executable resolves only in a known install directory

- **GIVEN** an installer wrote the agent executable into a known install directory that is absent from the inherited `PATH`
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the executable as present with its absolute path in that directory

#### Scenario: Executable is absent everywhere

- **GIVEN** the agent executable is reachable neither through `PATH` nor in any known install directory
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the executable as absent

#### Scenario: Both locations carry the executable

- **GIVEN** the agent executable is reachable through `PATH` and a different copy exists in a known install directory
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the `PATH` copy

### Requirement: Every availability surface MUST share one resolution rule

Quantex MUST apply the same executable resolution rule to install verification, inspection, listing, diagnostics, uninstall absence confirmation, adoption of untracked installs, and idempotency replay validation. No surface may answer availability from a narrower rule than another.

#### Scenario: Install and inspection agree

- **GIVEN** an install verified an executable that resolves only in a known install directory
- **WHEN** the user subsequently inspects or lists that agent
- **THEN** the agent is reported as installed with the same resolved executable path

#### Scenario: Uninstall does not declare a false removal

- **GIVEN** an uninstall removed the provider target but a resolvable executable remains in a known install directory
- **WHEN** Quantex confirms executable absence
- **THEN** Quantex does not report the executable as removed

### Requirement: A verified install MUST NOT be rolled back for PATH absence alone

Quantex MUST treat an executable that resolves under the shared resolution rule as satisfying the executable-presence postcondition. Quantex MUST NOT run the installation compensator, and MUST NOT report a verification failure, solely because the installed executable's directory is absent from the inherited `PATH`.

#### Scenario: Installer writes outside the inherited PATH

- **GIVEN** an install completes and writes the executable into a known install directory that the running process does not carry on `PATH`
- **WHEN** Quantex verifies the installation postcondition
- **THEN** verification succeeds, the installation is recorded as verified, and the compensator does not run

#### Scenario: Installation genuinely failed

- **GIVEN** an install reports completion but writes no executable that the resolution rule can find
- **WHEN** Quantex verifies the installation postcondition
- **THEN** Quantex reports a structured verification failure and runs the compensator

### Requirement: Execution and version probing MUST use the resolved executable path

When Quantex has resolved an absolute executable path for an agent, it SHALL launch that agent and probe its installed version through the resolved path rather than through the bare executable name. A catalog version-probe command whose first argument is not the agent's executable name MUST be invoked unchanged.

#### Scenario: Launching an agent resolved outside PATH

- **GIVEN** Quantex reports an agent as installed with a resolved path outside the inherited `PATH`
- **WHEN** the user runs that agent through Quantex
- **THEN** Quantex launches the resolved absolute path and the agent starts

#### Scenario: Version probe for an agent resolved outside PATH

- **GIVEN** an agent resolves only in a known install directory
- **WHEN** Quantex probes its installed version
- **THEN** Quantex invokes the resolved absolute path and reports the parsed version

#### Scenario: Custom probe command is preserved

- **GIVEN** a catalog entry declares a version-probe command whose first argument is not the agent's executable name
- **WHEN** Quantex probes the installed version
- **THEN** Quantex invokes the declared command without substituting a resolved path
