# runtime-boundaries Specification

## Purpose

Define the stable separation between Bun-powered repository and distribution tooling, runtime-neutral application code, external Bun provider operations, and the Node/standalone execution targets.
## Requirements
### Requirement: Application runtime SHALL remain independent of the in-process Bun global

Quantex application source under `src/**` SHALL NOT read, call, replace, or type against the process-wide `Bun` global. Generic process execution SHALL use a runtime-neutral boundary that works for both the Node 20 JavaScript distribution and standalone compiled binaries.

#### Scenario: Published JavaScript CLI launches a provider command

- **WHEN** a Node 20 installation invokes an agent observation or lifecycle operation
- **THEN** Quantex launches the provider command without requiring `globalThis.Bun`
- **AND** the established exit, standard-I/O, timeout, cancellation, and process-cleanup semantics remain unchanged

#### Scenario: Standalone binary launches a provider command

- **WHEN** a Bun-compiled standalone binary invokes the equivalent operation
- **THEN** it uses the same application process boundary as the JavaScript distribution
- **AND** no provider behavior depends on selecting a Bun-specific in-process spawn path

### Requirement: Bun provider identity SHALL remain external to the application runtime

Quantex SHALL retain `bun` as a first-party agent provider and self-install source. Bun-managed observation, install, update, uninstall, trust, and self-upgrade operations MUST execute the external `bun` command through the shared process boundary and MUST NOT require Bun runtime globals in provider or self-upgrade modules.

#### Scenario: Bun-managed agent lifecycle runs

- **WHEN** Quantex selects the Bun provider for an agent operation
- **THEN** it executes the maintained `bun` CLI command shape through the shared process boundary
- **AND** provider availability, evidence, registry, trust, rollback, and verification behavior remain compatible

#### Scenario: Bun-managed Quantex installation upgrades itself

- **WHEN** persisted or detected self-install evidence selects source `bun`
- **THEN** self-upgrade continues to invoke the external Bun provider with the resolved package tag and registry
- **AND** the `bun` self-install-source identity remains distinct from the repository's package-manager choice

### Requirement: Repository Bun tooling SHALL stay outside the product runtime boundary

The repository SHALL retain its pinned Bun package-manager, task-runner, and standalone-compiler workflows. Bun-native APIs MAY be used by repository scripts, but those APIs MUST NOT become application runtime dependencies merely because the scripts execute application modules.

#### Scenario: Contributor runs repository validation

- **WHEN** a contributor or CI invokes the maintained `bun run` commands
- **THEN** Bun installs dependencies and executes validation, build, smoke, and release-support scripts according to the repository contract
- **AND** the resulting application remains runnable through its documented Node and standalone distribution targets

#### Scenario: Release builds standalone binaries

- **WHEN** the release candidate pipeline invokes the standalone build
- **THEN** the compiler script may use Bun's compile capability for supported targets
- **AND** that compiler dependency does not require the published JavaScript CLI to run inside Bun

### Requirement: Tests SHALL expose accidental Bun runtime coupling

The default Vitest environment SHALL NOT create a fake process-wide Bun global. Tests SHALL mock the runtime-neutral process boundary or inject runtime ports, while explicit fixture programs MAY use Bun APIs only when the fixture intentionally exercises Bun-specific behavior.

#### Scenario: Application source adds a Bun global reference

- **WHEN** application TypeScript under `src/**` references the in-process `Bun` global
- **THEN** the architecture test fails and identifies the violating source path

#### Scenario: Provider unit test replaces process execution

- **WHEN** a package-manager, detection, version-probe, or self-upgrade test needs deterministic child-process behavior
- **THEN** it replaces `cross-spawn` or an injected `ProcessPort`
- **AND** it does not mutate `Bun.spawn` on a process-wide fake global

### Requirement: Read-only smoke enforcement SHALL cover every supported process path

Read-only lifecycle smoke execution SHALL reject mutation commands before execution whether a repository script uses Bun-native spawning or application code uses the Node-compatible process boundary. Allowed observation commands SHALL continue to execute and every guarded command SHALL remain recordable for post-run assertions.

#### Scenario: Application attempts a mutation during read-only smoke

- **WHEN** a read-only smoke command reaches the Node-compatible application process boundary with a mutation command
- **THEN** the preload rejects it before the target executable runs
- **AND** the failure identifies `READ_ONLY_MUTATION_BLOCKED`

#### Scenario: Bun-native script attempts a mutation during read-only smoke

- **WHEN** a Bun-native subprocess API receives the same mutation command under the guard
- **THEN** the preload applies the same allowlist and rejects it before execution

#### Scenario: Read-only observation is allowed

- **WHEN** either guarded process path receives a maintained observation command
- **THEN** the command executes
- **AND** the guard can record the exact command for smoke verification

### Requirement: New lifecycle mutation behavior SHALL land in in-repo Core, not a thicker CLI

Quantex SHALL place new or relocated agent lifecycle mutation behavior for
`install`, `ensure`, `update`, and `uninstall` in in-repo Core modules under the
Core ownership boundary for the 1.12 CLI lifecycle slice. The CLI MUST remain a
thin compatibility shell for presentation and process policy. Relocating those
engines MUST NOT, by itself, expand the published `quantex-core` package export
surface.

#### Scenario: Update or uninstall engine is selected

- **WHEN** the CLI selects Core for `update` or `uninstall`
- **THEN** the mutation engine executes from in-repo Core-owned modules
- **AND THEN** those modules remain absent from the published package root
  export unless a separately approved SDK change adds them

#### Scenario: CLI command module stays presentation-focused

- **WHEN** a promoted lifecycle command runs on the Core route
- **THEN** the command module may parse argv, choose the engine route, project
  Core outcomes into v1 human/JSON/NDJSON results, and apply exit policy
- **AND THEN** it does not become a second lifecycle engine implementation

### Requirement: CLI inspect, info, and resolve SHALL remain thin projectors over Core read observation

Quantex SHALL keep CLI `inspect`, `info`, and `resolve` as thin compatibility
shells for the 1.12 read-observation slice: they MAY parse argv, invoke in-repo
Core read observation, project Core outcomes into maintained v1 human/JSON/NDJSON
results, and apply exit policy. They MUST NOT become a second observation engine
implementation and MUST NOT re-wrap the published SDK `inspect()` surface into a
CLI-only API when the CLI contract is richer than the SDK type.

#### Scenario: Inspect or info command module stays presentation-focused

- **WHEN** a user invokes `inspect` or `info`
- **THEN** observation executes through the Core-backed CLI read adapter
- **AND THEN** the command module projects the observation into the maintained
  v1 CLI result without owning PATH probing or state reads outside that adapter

#### Scenario: Resolve command module stays presentation-focused

- **WHEN** a user invokes `resolve`
- **THEN** observation executes through the Core-backed CLI read adapter
- **AND THEN** the command module projects installed-path guidance or the
  maintained not-installed error contract without becoming a second observation
  engine

