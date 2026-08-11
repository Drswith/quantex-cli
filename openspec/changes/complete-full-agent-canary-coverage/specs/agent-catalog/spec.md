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
