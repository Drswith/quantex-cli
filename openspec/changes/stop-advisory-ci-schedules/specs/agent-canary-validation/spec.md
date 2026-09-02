# agent-canary-validation Delta

## MODIFIED Requirements

### Requirement: Real lifecycle canaries MUST run in a disposable environment

The real-agent canary workflow MUST run one selected agent per fresh GitHub-hosted runner job, set HOME and tool installation roots beneath the runner temporary directory, add the disposable local binary directory to PATH, and prepare the toolchain and non-interactive installer settings required by the selected provider. A provider with uninstall capability MUST remove the selected installation and verify absence. A provider without uninstall capability MUST clear Quantex tracking and rely on destruction of the fresh runner for physical removal. A deliberate source-conflict probe MUST create and remove its controlled alternate executable, verify the exact typed conflict outcome, and complete final cleanup. The workflow MUST NOT require agent credentials, Modal credentials, or mutate a developer workstation.

#### Scenario: Pull request canary

- **WHEN** a pull request changes paths classified as sandbox-relevant
- **THEN** the workflow runs the quick matrix with a temporary HOME and the focused probe scenario

#### Scenario: Manually dispatched full canary

- **WHEN** a maintainer manually dispatches the full canary scope
- **THEN** the workflow creates parallel disposable jobs for every Linux catalog entry, provisions the selected provider toolchain and setup policy, and executes each named coverage mode

#### Scenario: Install-only provider cleanup

- **GIVEN** a matrix entry selected a provider that does not implement uninstall
- **WHEN** its install, inspect, list, and required-version assertions succeed
- **THEN** the probe clears Quantex tracking without asserting physical binary absence and the disposable runner teardown removes the remaining files

#### Scenario: Claude single-source cleanup

- **GIVEN** Claude updates and installer migration are disabled for the Bun lifecycle and the disposable PATH is asserted free of any preinstalled Claude executable
- **WHEN** the normal probe installs, versions, and uninstalls Claude
- **THEN** the Bun package and Claude executable are absent and the job does not use a cleanup exception

#### Scenario: Deliberate Claude source conflict

- **GIVEN** the conflict probe adds a controlled alternate Claude executable after a verified Bun installation
- **WHEN** Quantex removes the Bun source
- **THEN** uninstall returns `UNINSTALL_FAILED` with lifecycle `conflicting-source`
- **AND** the probe removes the fixture and verifies the already-removed Bun source is absent without issuing a redundant second uninstall or recording a skip

### Requirement: Real canaries MUST remain advisory and separate from Modal transport tests

The canary workflow MUST run on relevant pull requests and manual dispatch without becoming a required branch-protection context. It MUST NOT declare a standing schedule. The existing Modal/Docker isolation commands MUST remain available for explicit transport and scenario validation, and workflow documentation MUST distinguish their purposes.

#### Scenario: Canary failure does not block merge by itself

- **WHEN** an upstream installer fails in the advisory canary workflow
- **THEN** the failure is visible in workflow results but is not declared as a required merge gate

#### Scenario: Modal remains an explicit isolation option

- **WHEN** a contributor needs remote transport or broad sandbox scenarios
- **THEN** the contributor can still invoke the existing Modal isolation command independently of the canary matrix

#### Scenario: Standing schedule is absent

- **WHEN** a contributor inspects the agent-canary workflow triggers
- **THEN** the workflow MUST NOT declare a `schedule` event
- **AND** it MUST still declare `pull_request` and `workflow_dispatch`
