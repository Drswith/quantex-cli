## ADDED Requirements

### Requirement: Canary matrix selection MUST be catalog-driven and deterministic

The canary selector MUST read the checked-in agent catalog and emit JSON matrix entries containing an agent name, the provider selected by a deterministic CI-ready preference, whether the selected catalog candidate declares an installed-version probe, and any explicit reason the credential-free non-interactive runner cannot exercise that entry. The quick scope MUST include the Pi agent and the full scope MUST include every catalog agent with a Linux candidate, including explicitly unsupported entries. The selector MUST reject an unknown scope, a missing quick-scope anchor, or an invalid provider override instead of silently returning an incomplete matrix.

#### Scenario: Quick scope includes the Pi regression target

- **WHEN** the selector is invoked with the quick scope
- **THEN** it emits a stable JSON matrix containing Pi and the maintained quick-scope anchors

#### Scenario: Full scope follows the catalog

- **WHEN** the selector is invoked with the full scope
- **THEN** it emits one entry for each catalog agent that has a Linux install candidate and includes the selected provider metadata

#### Scenario: Managed candidate avoids an install-only script

- **GIVEN** a Linux catalog entry exposes a CI-ready managed provider as well as a script installer
- **WHEN** the full selector chooses that entry's canary candidate
- **THEN** it selects the managed provider and derives version requirements from that exact candidate

#### Scenario: Non-interactive runner incompatibility remains visible

- **GIVEN** an agent's only practical Linux installer requires credentials, an interactive login, or a terminal device
- **WHEN** the full selector emits the entry
- **THEN** the entry remains in the matrix with a non-empty unsupported reason that the probe reports separately from passes and failures

#### Scenario: Invalid scope fails closed

- **WHEN** the selector receives a scope other than quick or full
- **THEN** it exits with a validation error and does not emit a partial matrix

### Requirement: Real lifecycle canaries MUST run in a disposable environment

The real-agent canary workflow MUST run one selected agent per fresh GitHub-hosted runner job, set HOME and the Bun install root beneath the runner temporary directory, and prepare the toolchain required by the selected managed provider. A provider with uninstall capability MUST remove the selected installation in a cleanup path. A provider without uninstall capability MUST clear Quantex tracking and rely on destruction of the fresh runner for physical removal. The workflow MUST NOT require agent credentials, Modal credentials, or mutate a developer workstation.

#### Scenario: Pull request canary

- **WHEN** a pull request changes paths classified as sandbox-relevant
- **THEN** the workflow runs the quick matrix with a temporary HOME and the focused probe scenario

#### Scenario: Scheduled full canary

- **WHEN** the scheduled or manually dispatched full scope runs
- **THEN** the workflow creates parallel disposable jobs for every Linux catalog entry, provisions the selected provider toolchain, and cleans up each job according to provider capability

#### Scenario: Install-only provider cleanup

- **GIVEN** a matrix entry selected a provider that does not implement uninstall
- **WHEN** its install, inspect, and list assertions succeed
- **THEN** the probe clears Quantex tracking without asserting physical binary absence and the disposable runner teardown removes the remaining files

### Requirement: The probe scenario MUST verify installed-version evidence

The lifecycle smoke `probe` scenario MUST install each runnable selected agent, refresh `inspect` and `list`, and require a non-empty installed version for matrix entries whose candidate declares an installed-version probe. It MUST fail when required version evidence is absent and MUST preserve the selected agent in the in-flight cleanup stack when any assertion fails. An explicit unsupported-runner entry MUST be reported by name and reason before installation and MUST NOT be counted as a pass.

#### Scenario: Version is exposed after installation

- **WHEN** a selected agent installs successfully and its candidate declares an installed-version probe
- **THEN** refreshed inspection and the corresponding list row contain a non-empty installed version

#### Scenario: Missing version is surfaced as a canary failure

- **WHEN** installation succeeds but refreshed inspection has no required installed version
- **THEN** the probe exits non-zero with the agent name in the failure message

#### Scenario: Probe cleanup runs after a failed assertion

- **WHEN** a probe assertion fails after installation
- **THEN** the smoke process attempts to uninstall the selected agent before exiting

#### Scenario: Explicit unsupported entry is not executed

- **GIVEN** the matrix entry carries a reviewed unsupported-runner reason
- **WHEN** the focused probe starts
- **THEN** it reports the agent and reason as skipped and does not invoke the upstream installer

### Requirement: Successful version probes MUST accept stderr-only output

The legacy and Core observation paths MUST parse stderr when a version command exits successfully and produces no stdout. They MUST prefer stdout when both streams contain output, continue to honor configured parsers, and continue to return no version for a non-zero exit.

#### Scenario: Pi-style stderr-only version output

- **WHEN** an agent's `--version` command exits zero with an empty stdout and a version on stderr
- **THEN** inspection returns the parsed version

#### Scenario: Stdout remains authoritative when populated

- **WHEN** a successful version command writes different values to stdout and stderr
- **THEN** the observation parses stdout and ignores stderr for the selected version

#### Scenario: Failed version command remains unknown

- **WHEN** the version command exits non-zero even though stderr contains a version-looking string
- **THEN** the observation returns no installed version

### Requirement: Real canaries MUST remain advisory and separate from Modal transport tests

The canary workflow MUST run on relevant pull requests and scheduled/manual events without becoming a required branch-protection context. The existing Modal/Docker isolation commands MUST remain available for explicit transport and scenario validation, and workflow documentation MUST distinguish their purposes.

#### Scenario: Canary failure does not block merge by itself

- **WHEN** an upstream installer fails in the advisory canary workflow
- **THEN** the failure is visible in workflow results but is not declared as a required merge gate

#### Scenario: Modal remains an explicit isolation option

- **WHEN** a contributor needs remote transport or broad sandbox scenarios
- **THEN** the contributor can still invoke the existing Modal isolation command independently of the canary matrix
