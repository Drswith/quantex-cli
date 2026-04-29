## ADDED Requirements

### Requirement: Optional isolation validation commands

The repository SHALL expose `bun run test:sandbox` and `bun run test:container` as optional maintainer-facing validation commands for running real Quantex agent lifecycle smoke checks inside isolated Bun environments. These commands MUST complement rather than replace the canonical local `bun run test` workflow.

#### Scenario: Contributor runs local container isolation with default targets

- **WHEN** a contributor runs `bun run test:container`
- **THEN** the repository invokes Docker against a Bun container that mounts the current checkout
- **AND** the container command copies the checkout into an internal temporary work directory
- **AND** it installs repository dependencies inside the isolated environment before running the default lifecycle smoke flow
- **AND** the default lifecycle smoke flow executes real Quantex CLI install, inspect, resolve, ensure, update, and uninstall commands for the selected agent list
- **AND** the default lifecycle smoke flow verifies that Quantex can adopt an agent that was installed before Quantex started tracking it
- **AND** the default lifecycle smoke flow verifies that ambiguous multi-install-method PATH detections remain untracked
- **AND** the default lifecycle smoke flow verifies Quantex's standalone binary entrypoint and self-upgrade inspection surface
- **AND** the command exits non-zero if the isolated validation fails

#### Scenario: Contributor runs sandbox validation with default targets

- **WHEN** a contributor runs `bun run test:sandbox`
- **THEN** the repository invokes the Modal CLI against a sandbox container that mounts the current checkout
- **AND** the sandbox command copies the checkout into an internal temporary work directory
- **AND** it installs repository dependencies inside the isolated environment before running the default lifecycle smoke flow
- **AND** the default lifecycle smoke flow executes real Quantex CLI install, inspect, resolve, ensure, update, and uninstall commands for the selected agent list
- **AND** the default lifecycle smoke flow verifies that Quantex can adopt an agent that was installed before Quantex started tracking it
- **AND** the default lifecycle smoke flow verifies that ambiguous multi-install-method PATH detections remain untracked
- **AND** the default lifecycle smoke flow verifies Quantex's standalone binary entrypoint and self-upgrade inspection surface
- **AND** the command exits non-zero if the remote validation fails

#### Scenario: Contributor needs a different agent smoke list

- **WHEN** a contributor passes explicit agent slugs after `bun run test:sandbox --` or `bun run test:container --`
- **THEN** the repository forwards those agent slugs to the isolated lifecycle smoke script
- **AND** the default agent list is skipped for that invocation

#### Scenario: Contributor needs a narrower scenario set

- **WHEN** a contributor sets `QTX_ISOLATION_SCENARIOS`
- **THEN** the isolated lifecycle smoke script runs only the named scenarios
- **AND** omitted scenarios do not run for that invocation

#### Scenario: External lifecycle command stalls

- **WHEN** an isolated lifecycle command exceeds the configured command timeout
- **THEN** the smoke script terminates that command
- **AND** the isolation validation fails instead of hanging indefinitely

#### Scenario: Contributor follows normal local validation

- **WHEN** a contributor reads the repository's maintainer-facing validation guidance
- **THEN** the guidance still presents `bun run test` as the default local suite
- **AND** it describes `bun run test:container` and `bun run test:sandbox` as opt-in isolation layers for host-sensitive checks rather than mandatory replacements

#### Scenario: Docker prerequisite is missing

- **WHEN** a contributor runs `bun run test:container` without a working `docker` CLI on `PATH`
- **THEN** the command exits non-zero
- **AND** stderr explains that Docker must be installed before container isolation can run

#### Scenario: Modal CLI prerequisite is missing

- **WHEN** a contributor runs `bun run test:sandbox` without a working `modal` CLI on `PATH`
- **THEN** the command exits non-zero
- **AND** stderr explains that Modal must be installed and authenticated before sandbox validation can run

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

The repository SHALL keep Modal-backed isolation validation in a dedicated GitHub Actions workflow instead of adding it to the merge-gating `ci.yml` workflow.

#### Scenario: Maintainer inspects GitHub Actions workflows

- **WHEN** a maintainer inspects the repository workflows for isolation validation
- **THEN** a dedicated workflow exists for Modal-backed sandbox tests
- **AND** the merge-gating `ci.yml` workflow does not require Modal credentials to complete its normal validation path
- **AND** the dedicated Modal workflow runs an expanded real-agent smoke set that includes a multi-install-method agent
