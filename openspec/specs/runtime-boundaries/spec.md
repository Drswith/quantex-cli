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
surface. After the install/ensure escape retirement, Quantex MUST NOT keep a
second CLI install/ensure mutation or dry-run engine beside Core.

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

#### Scenario: Install or ensure has no parallel legacy engine

- **WHEN** Core owns CLI `install` or `ensure`
- **THEN** Quantex does not retain a second install/ensure engine route for
  env escape or dry-run planning
- **AND THEN** only the thin CLI projection over Core remains for those
  commands

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

### Requirement: CLI exec and shortcut SHALL remain thin facades over Core execution

Quantex SHALL keep CLI `exec` and shortcut `qtx <agent> [args...]` as thin
compatibility shells for the 1.12 exec slice: they MAY parse argv, choose
`--install` policy, invoke the in-repo Core execution engine through a CLI
bridge, project Core outcomes into maintained v1 human/JSON results, apply exit
policy, and supply process I/O policy (including inherited standard I/O for
human agent launch). When `--install` authorizes installing a missing agent,
that mutation MUST run through the in-repo Core install/ensure engine rather
than a retained lifecycle reconcile port. They MUST NOT become a second
launch-engine or install-engine implementation and MUST NOT re-wrap a published
SDK `run()` / `exec()` surface into a CLI-only API.

#### Scenario: Exec command module stays presentation-focused

- **WHEN** a user invokes `exec`
- **THEN** observe/install/launch ownership executes through the Core execution
  engine behind the CLI bridge, with install mutation delegated to Core
  install/ensure when required
- **AND THEN** the command path projects the outcome into the maintained v1 CLI
  result without owning a second launch state machine

#### Scenario: Shortcut stays presentation-focused over the same Core engine

- **WHEN** a user invokes shortcut `qtx <agent> [args...]`
- **THEN** launch executes through the same Core execution engine used by `exec`
- **AND THEN** shortcut argv parsing and process I/O policy remain CLI-owned

#### Scenario: Human agent launch keeps inherited standard I/O

- **WHEN** `exec` or shortcut launches an installed agent in human output mode
- **THEN** the CLI-supplied process I/O policy inherits stdin, stdout, and
  stderr for the agent process
- **AND THEN** that policy is applied through the Core execution engine rather
  than a second CLI-local spawn path
- **AND THEN** interactive agent I/O behavior remains unchanged from the
  pre-slice CLI contract

#### Scenario: Structured exec output omits engine and route identifiers

- **WHEN** `exec` or shortcut-backed presentation emits JSON or NDJSON
- **THEN** the maintained payload does not include selected engine or route
  identifiers
- **AND THEN** engine or route diagnostics remain absent from those payloads
  (debug stderr only, when emitted)

### Requirement: CLI doctor SHALL remain a thin facade over Core diagnosis

Quantex SHALL keep CLI `doctor` as a thin compatibility shell for the 1.12
doctor slice: it MAY gather CLI-coupled installer/self/agent observations
through a bridge, invoke the in-repo Core diagnosis engine, project Core
outcomes into maintained v1 human/JSON results, and apply exit policy. It MUST
NOT become a second diagnosis-engine implementation and MUST NOT re-wrap a
published SDK `doctor()` / `diagnose()` surface into a CLI-only API.

#### Scenario: Doctor command module stays presentation-focused

- **WHEN** a user invokes `doctor`
- **THEN** diagnosis ownership executes through the Core diagnosis engine behind
  the CLI bridge
- **AND THEN** the command path projects the outcome into the maintained v1 CLI
  result without owning a second issue-synthesis state machine

#### Scenario: Structured doctor output omits engine and route identifiers

- **WHEN** `doctor` emits JSON
- **THEN** the maintained payload does not include selected engine or route
  identifiers
- **AND THEN** engine or route diagnostics remain absent from those payloads
  (debug stderr only, when emitted)

### Requirement: Install and ensure SHALL not retain a parallel legacy engine route

Quantex SHALL keep CLI `install` and `ensure` as thin projections over in-repo
Core only after the 1.12 retirement of the install/ensure whole-invocation
escape. Those command modules MAY parse argv, project Core apply/preview
outcomes into maintained v1 human/JSON/NDJSON results, and apply exit policy.
They MUST NOT retain a second install/ensure apply engine selected by
`QUANTEX_INSTALLATION_ENGINE`. Install/ensure `--dry-run` MAY keep the
maintained v1 observation short-circuit planner until Core preview matches
those frozen contracts.

#### Scenario: Install or ensure has no env-selected second engine

- **WHEN** a user invokes `install` or `ensure` with
  `QUANTEX_INSTALLATION_ENGINE=legacy`
- **THEN** lifecycle ownership still executes through in-repo Core
- **AND THEN** the command module does not branch onto a retained legacy
  install/ensure engine

#### Scenario: Install or ensure dry-run stays on the retained planner

- **WHEN** a user invokes `install` or `ensure` with `--dry-run`
- **THEN** planning executes through the retained v1 observation short-circuit
  path
- **AND THEN** the CLI does not invoke Core apply mutation for that request

### Requirement: Exec and shortcut install-before-launch SHALL use Core install/ensure

Quantex SHALL install a missing agent for CLI `exec` / shortcut through the same
in-repo Core install/ensure engine used by CLI `install` / `ensure` when the
selected `--install` policy authorizes mutation. The production execution bridge
MAY adapt Core outcomes into the Core execution engine's install port. It MUST
NOT call `reconcileAgentInstallation` or otherwise retain a second install
mutation engine beside Core for that path.

#### Scenario: Exec install-if-missing uses Core installation

- **WHEN** `exec` must install a missing agent under an authorized `--install`
  policy
- **THEN** mutation ownership executes through the in-repo Core install/ensure
  engine
- **AND THEN** the production bridge does not call `reconcileAgentInstallation`

#### Scenario: Shortcut shares the same install path

- **WHEN** shortcut `qtx <agent>` reaches the shared launch path and must
  install before launch
- **THEN** installation uses the same Core install/ensure path as `exec`
- **AND THEN** argv presentation and process I/O policy remain CLI-owned

