# agent-canary-validation Specification

## Purpose

Define the repository contract for catalog-driven real-agent canary selection, disposable lifecycle execution, semantic version assertions, cleanup classification, and separation from broader Docker or Modal isolation testing.
## Requirements
### Requirement: Canary matrix selection MUST be catalog-driven and deterministic

The canary selector MUST read the checked-in agent catalog and emit JSON matrix entries containing an agent name, the selected catalog provider, whether that candidate declares an installed-version probe, an explicit lifecycle coverage mode, the installer setup policy, whether upstream updates are disabled, and whether to run a deliberate source-conflict probe. The selector MUST prefer CI-ready providers that the product configuration can reorder, while any reviewed provider override MUST reference an actual candidate that production ordering can select and expose the selected provider in the matrix. The quick scope MUST include the Pi agent and the full scope MUST include every catalog agent with a Linux candidate. The selector MUST NOT emit an agent-level pre-install skip or cleanup-skip policy. It MUST reject an unknown scope, a missing quick-scope anchor, or an invalid provider override instead of silently returning an incomplete matrix.

#### Scenario: Quick scope includes the Pi regression target

- **WHEN** the selector is invoked with the quick scope
- **THEN** it emits a stable JSON matrix containing Pi and the maintained quick-scope anchors

#### Scenario: Full scope follows the catalog

- **WHEN** the selector is invoked with the full scope
- **THEN** it emits one runnable coverage entry for each catalog agent that has a Linux install candidate and includes the selected provider metadata
- **AND** no entry carries a reason to skip installation or cleanup

#### Scenario: Configurable managed candidate avoids an install-only script

- **GIVEN** a Linux catalog entry exposes a CI-ready managed provider that `defaultPackageManager` can select as well as a script installer
- **WHEN** the full selector chooses that entry's canary candidate
- **THEN** it selects the managed provider and derives version requirements from that exact candidate

#### Scenario: Autohand uses its official npm lifecycle

- **GIVEN** Autohand exposes both its official native script and official npm package
- **WHEN** the full selector resolves its Linux canary entry
- **THEN** it selects npm, requires installed-version evidence, and leaves the script source available to normal product ordering

#### Scenario: Matrix provider matches the runtime-selected source

- **GIVEN** a matrix entry names a selected provider
- **WHEN** the probe applies the corresponding production configuration and installs the agent
- **THEN** the runtime-selected source matches the matrix provider
- **AND** the canary does not claim a provider that the production ordering path ignored

#### Scenario: Credential-bound setup is a coverage boundary

- **GIVEN** an official installer acquires a usable binary before entering account authentication
- **WHEN** the selector emits its credential-free entry
- **THEN** the entry names binary-lifecycle coverage and deferred account setup instead of marking the whole agent skipped

#### Scenario: Invalid scope fails closed

- **WHEN** the selector receives a scope other than quick or full
- **THEN** it exits with a validation error and does not emit a partial matrix

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

### Requirement: The probe scenario MUST verify installed-version evidence

The lifecycle smoke `probe` scenario MUST install each selected agent, refresh `inspect` and `list`, and require a non-empty installed version for matrix entries whose candidate declares an installed-version probe. It MUST fail when required version evidence is absent and MUST preserve the selected agent for cleanup when any assertion fails.

The probe MUST assert the lifecycle classification implied by the matrix entry's selected provider rather than requiring a single classification for every agent. A provider that Quantex classifies as unmanaged MUST NOT fail the probe for reporting `unmanaged`.

#### Scenario: Version is exposed after installation

- **WHEN** a selected agent installs successfully and its candidate declares an installed-version probe
- **THEN** refreshed inspection and the corresponding list row contain a non-empty installed version

#### Scenario: Missing version is surfaced as a canary failure

- **WHEN** installation succeeds but refreshed inspection has no required installed version
- **THEN** the probe exits non-zero with the agent name in the failure message

#### Scenario: Probe cleanup runs after a failed assertion

- **WHEN** a probe assertion fails after installation
- **THEN** the smoke process attempts to uninstall the selected agent before exiting

#### Scenario: Script-provider agent reports an unmanaged lifecycle

- **GIVEN** the matrix entry selected a provider that Quantex classifies as unmanaged
- **WHEN** the probe inspects the agent after installation
- **THEN** the probe accepts the reported `unmanaged` lifecycle and does not fail

#### Scenario: Managed provider still requires a managed lifecycle

- **GIVEN** the matrix entry selected a provider that Quantex classifies as managed
- **WHEN** refreshed inspection reports a lifecycle other than `managed`
- **THEN** the probe exits non-zero with the agent name in the failure message

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

### Requirement: uv-backed disposable canaries MUST disable a non-invalidating package cache

The real-agent canary workflow MUST disable `setup-uv`'s persisted package cache when the repository has no checked-in Python dependency manifest capable of invalidating that cache. It MUST continue to install uv and execute the selected agent lifecycle, and it MUST NOT merely suppress the missing-dependency warning while retaining a `no-dependency-glob` cache.

#### Scenario: uv provider has no repository dependency manifest

- **GIVEN** a canary matrix entry uses uv and the repository contains no matching Python dependency or lock file
- **WHEN** the workflow prepares the uv provider on a GitHub-hosted runner
- **THEN** setup-uv dependency caching is explicitly disabled
- **AND** the agent install, inspection, version, list, and cleanup lifecycle still executes

### Requirement: Real package-provider update coverage MUST exercise a receipt-writing upgrade

The real-agent lifecycle smoke MUST include a disposable package-provider scenario that seeds a selected smoke agent at a valid stable version lower than the registry's current `latest`, adopts that installation through Quantex, and runs `qtx update` with refreshed version metadata. The scenario MUST require an `updated` result, verify that the update-written lifecycle receipt is present, and pass that receipt directly into the following `qtx uninstall` operation. A missing predecessor version, unavailable registry, no-op update, or failed receipt-consuming uninstall MUST fail the canary rather than be reported as skipped coverage.

#### Scenario: Quick canary reaches the managed update receipt branch

- **GIVEN** the quick matrix selects the `opencode` Bun package provider in a fresh disposable HOME
- **WHEN** the lifecycle probe resolves a stable package version below the current registry `latest`, installs that version, and asks Quantex to adopt it
- **THEN** `qtx update` MUST report an actual `updated` result after refreshing version metadata
- **AND** the persisted lifecycle receipt MUST contain the agent's executable name
- **AND** the subsequent `qtx uninstall opencode` MUST succeed and remove the installation

#### Scenario: Upgrade evidence cannot be downgraded to a no-op pass

- **GIVEN** the selected package has no valid lower stable SemVer or its registry metadata cannot be read
- **WHEN** the real-upgrade scenario prepares its seeded installation
- **THEN** the canary MUST fail with the package/registry reason
- **AND** it MUST NOT claim successful lifecycle coverage from an `up-to-date` result

### Requirement: Lifecycle receipt writers MUST remain compatible with uninstall readers for every provider type

The repository contract suite MUST capture the receipt emitted by each remaining
lifecycle receipt writer—the Core install engine and the managed update
path—for every provider in the first-party provider registry. For each captured
receipt, the suite MUST resolve the corresponding installed-state and receipt
bindings and assert that the uninstall reconciliation comparator accepts
matching provider, target identity, target kind, and the agent's default
executable name. The suite MUST continue to reject a genuinely different
executable name as a source conflict. After exec `--install` leaves the legacy
reconcile install writer, that writer MUST NOT remain a required contract
capture source.

#### Scenario: Package-provider install and update shapes reconcile

- **GIVEN** a package-provider installed state omits its default executable name
- **WHEN** a Core install writer emits a receipt without that optional field and
  the update writer emits a receipt that includes it
- **THEN** both receipts MUST be accepted by the uninstall reader for the same
  provider target

#### Scenario: Explicit executable providers remain covered

- **GIVEN** a deno, script, or binary provider state records an explicit
  executable identity
- **WHEN** each install and update writer emits its receipt
- **THEN** the receipt MUST reconcile with the installed-state binding without
  losing the explicit executable identity

#### Scenario: A genuinely different executable remains a conflict

- **GIVEN** a receipt names an executable different from the agent's declared
  default and the installed-state binding
- **WHEN** the uninstall reader compares the two bindings
- **THEN** the contract test MUST fail that comparison as a conflicting source

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

