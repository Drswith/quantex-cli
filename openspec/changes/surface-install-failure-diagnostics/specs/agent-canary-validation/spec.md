## ADDED Requirements

### Requirement: The probe skips an entry with no available provider

The lifecycle smoke `probe` scenario MUST treat "no installation provider is currently available" as a skip for that matrix entry rather than a failure. The canary reports on Quantex and on upstream installers; which toolchains a runner image happens to ship is not a Quantex defect.

A skip MUST be reported by name and reason so the run is not silently narrowed, and MUST NOT mark the entry as passing.

#### Scenario: The runner lacks the provider toolchain

- **GIVEN** a matrix entry whose only declared provider is absent from the runner
- **WHEN** the probe installs that agent
- **THEN** the probe records a skip naming the agent and the unavailable provider, and does not exit non-zero for that entry

#### Scenario: An available provider that fails still fails the probe

- **GIVEN** a matrix entry whose provider is available on the runner
- **WHEN** installation fails for any reason other than provider unavailability
- **THEN** the probe exits non-zero with the agent name in the failure message

#### Scenario: A skip is distinguishable from a pass

- **WHEN** the probe finishes a run containing at least one skipped entry
- **THEN** the summary reports skipped entries separately from successful ones
