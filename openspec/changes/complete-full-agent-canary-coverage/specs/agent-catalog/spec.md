## ADDED Requirements

### Requirement: Credential-free canary routes MUST declare installed-version evidence

Catalog candidates selected for credential-free Goose, Junie, and Devin lifecycle canaries MUST declare the installed-version probe when their unauthenticated version command is available, so real canaries verify semantic version evidence rather than executable presence alone.

#### Scenario: Goose official script route

- **WHEN** the Linux Goose script candidate is selected with interactive configuration disabled
- **THEN** its catalog probes require `goose --version` evidence after installation

#### Scenario: Junie official script route

- **WHEN** the Linux Junie official script candidate is selected for the canary
- **THEN** its catalog probes require `junie --version` evidence after installation

#### Scenario: Devin binary lifecycle route

- **WHEN** the official Devin installer has acquired the executable and account setup is deferred
- **THEN** its catalog probes require `devin version` evidence before Quantex reports the binary lifecycle as verified

### Requirement: Junie catalog ownership MUST match the durable installation

The Junie catalog MUST NOT advertise Bun or npm as managed installation sources while those packages delegate to an external native installation that remains after package removal. Linux and macOS MUST retain the official install script as an install-only source, and Windows MUST retain the official PowerShell installer.

#### Scenario: Junie package wrapper is not treated as managed

- **GIVEN** the Junie package postinstall writes its durable shim and native payload outside the package-manager root
- **WHEN** Quantex resolves Junie installation candidates
- **THEN** it does not select Bun or npm as a managed source
- **AND** the official script source remains available for automated install, inspect, list, version, and untracking coverage

### Requirement: Autohand MUST expose its official npm lifecycle without removing the script source

The Autohand catalog MUST retain its official native script installer and MUST also expose the official `autohand-cli` npm package as a managed candidate on supported platforms. The npm candidate MUST declare executable, installed-version, package-presence, and target-version probes.

#### Scenario: Full canary selects the managed Autohand source

- **GIVEN** the mutable native release asset fails its own startup probe
- **WHEN** the full canary configures npm as the production-selectable package-manager preference
- **THEN** Quantex installs `autohand-cli` through npm
- **AND** inspect, list, package version, uninstall, and physical absence are verified without a skip
