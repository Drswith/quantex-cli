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

#### Scenario: Scheduled full canary

- **WHEN** the scheduled or manually dispatched full scope runs
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

The lifecycle smoke `probe` scenario MUST install or adopt each selected agent according to its named coverage mode, refresh `inspect` and `list`, and require a non-empty installed version for matrix entries whose candidate declares an installed-version probe. It MUST fail when required version evidence is absent, when a selected provider is unavailable, or when an installer or cleanup outcome differs from its exact policy. A failed cleanup MUST report the executable path that Quantex can still resolve so source ownership can be diagnosed without weakening the assertion. It MUST preserve the selected agent in the in-flight cleanup stack when any assertion fails. Deferred credentialed setup MUST be reported separately from the binary lifecycle and MUST NOT be counted as a skipped agent.

#### Scenario: Version is exposed after installation

- **WHEN** a selected agent installs successfully and its candidate declares an installed-version probe
- **THEN** refreshed inspection and the corresponding list row contain the same non-empty installed version

#### Scenario: Missing version is surfaced as a canary failure

- **WHEN** installation succeeds but refreshed inspection has no required installed version
- **THEN** the probe exits non-zero with the agent name in the failure message

#### Scenario: Probe cleanup runs after a failed assertion

- **WHEN** a probe assertion fails after installation or adoption
- **THEN** the smoke process attempts to uninstall or untrack the selected agent before exiting

#### Scenario: Failed cleanup exposes the remaining executable

- **WHEN** a provider reports successful removal but the agent executable remains resolvable
- **THEN** the probe fails and prints the remaining resolved executable path for source diagnosis

#### Scenario: Devin binary lifecycle remains explicit

- **GIVEN** the official Devin installer acquired a version-reporting executable before credentialed setup
- **WHEN** the focused probe runs in binary-lifecycle mode
- **THEN** Quantex adopts the supported script source and verifies inspect, list, and version evidence
- **AND** the output states that account setup is deferred rather than claiming an authenticated pass

#### Scenario: Provider unavailability is not converted to skip

- **WHEN** the workflow-owned provider toolchain is unavailable or the selected installer cannot execute
- **THEN** the advisory agent job fails with the concrete error instead of reporting a skipped or successful lifecycle

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

### Requirement: uv-backed disposable canaries MUST disable a non-invalidating package cache

The real-agent canary workflow MUST disable `setup-uv`'s persisted package cache when the repository has no checked-in Python dependency manifest capable of invalidating that cache. It MUST continue to install uv and execute the selected agent lifecycle, and it MUST NOT merely suppress the missing-dependency warning while retaining a `no-dependency-glob` cache.

#### Scenario: uv provider has no repository dependency manifest

- **GIVEN** a canary matrix entry uses uv and the repository contains no matching Python dependency or lock file
- **WHEN** the workflow prepares the uv provider on a GitHub-hosted runner
- **THEN** setup-uv dependency caching is explicitly disabled
- **AND** the agent install, inspection, version, list, and cleanup lifecycle still executes
