# agent-catalog Specification

## Purpose
Define supported agent catalog metadata fields, lookup behavior, and lifecycle-focused inspection surfaces for install, inspect, update, and execution.
## Requirements
### Requirement: Supported agent catalog entries MUST stay lifecycle-focused

Quantex SHALL keep supported agent catalog metadata scoped to values that directly support installation, inspection, resolution, execution, update planning, and stable machine-readable contracts.

#### Scenario: Resolving a displayed agent name

- GIVEN a supported agent entry has a `displayName`
- WHEN a lifecycle command receives that display name as its agent input
- THEN Quantex resolves the input to the same supported agent as the canonical name
- AND canonical names and lookup aliases remain valid lookup keys

### Requirement: Lifecycle inspection surfaces MUST avoid localized descriptive metadata

Quantex lifecycle inspection surfaces SHALL expose stable agent identifiers and lifecycle metadata without requiring localized prose fields.

#### Scenario: Rendering or returning agent metadata

- **GIVEN** the user runs `quantex info <agent>` or `quantex inspect <agent>`
- **WHEN** Quantex returns human-readable or structured agent metadata
- **THEN** the result includes the identifiers and lifecycle fields needed to install, inspect, or update the agent
- **AND** the result does not depend on a free-form `description` field to remain valid

### Requirement: Qoder CLI MUST be a supported lifecycle agent

Quantex SHALL include Qoder CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Qoder CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `qoder` or the alias `qodercli`
- **THEN** Quantex returns a supported agent entry for Qoder CLI
- **AND** the entry identifies `qodercli` as the executable binary
- **AND** the entry identifies `@qoder-ai/qodercli` as its npm package metadata

#### Scenario: Installing Qoder CLI through supported methods

- **WHEN** Quantex renders or executes install options for Qoder CLI
- **THEN** the catalog includes npm-compatible managed install methods
- **AND** macOS and Linux include the official Homebrew cask and curl installer options
- **AND** Windows includes npm-compatible managed install methods

#### Scenario: Planning Qoder CLI updates

- **WHEN** Quantex plans an update for a Qoder CLI installation that supports self-update
- **THEN** the catalog exposes `qodercli update` as the agent self-update command

### Requirement: Qwen Code MUST be a supported lifecycle agent

Quantex SHALL include Qwen Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Qwen Code

- **WHEN** a user or machine consumer looks up the canonical agent name `qwen`
- **THEN** Quantex returns a supported agent entry for Qwen Code
- **AND** the entry identifies `qwen` as the executable binary
- **AND** the entry identifies `@qwen-code/qwen-code` as its npm package metadata

#### Scenario: Installing Qwen Code through supported methods

- **WHEN** Quantex renders or executes install options for Qwen Code
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official Homebrew formula and curl installer options
- **AND** Windows includes the official batch installer option

### Requirement: Kimi Code CLI MUST be a supported lifecycle agent

Quantex SHALL include Kimi Code CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Kimi Code CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `kimi` or the aliases `kimi-code` or `kimi-cli`
- **THEN** Quantex returns a supported agent entry for Kimi Code CLI
- **AND** the entry identifies `kimi` as the executable binary
- **AND** the entry identifies `@moonshot-ai/kimi-code` as its npm package metadata

#### Scenario: Installing Kimi Code CLI through supported methods

- **WHEN** Quantex renders or executes install options for Kimi Code CLI
- **THEN** macOS and Linux include the official current curl install script option (`curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash`)
- **AND** Windows includes the official current PowerShell install script option (`irm https://code.kimi.com/kimi-code/install.ps1 | iex`)
- **AND** Windows, macOS, and Linux include the npm-compatible managed install method
- **AND** the entry does not include uv managed install methods for fresh Kimi Code CLI installs

#### Scenario: Probing Kimi Code CLI version

- **WHEN** Quantex probes the installed version of Kimi Code CLI
- **THEN** it runs `kimi --version` and parses the output

#### Scenario: Planning Kimi Code CLI updates

- **WHEN** Quantex plans an update for a Kimi Code CLI installation that supports self-update
- **THEN** the catalog exposes `kimi upgrade` as the agent self-update command

### Requirement: MiMoCode MUST be a supported lifecycle agent

Quantex SHALL include MiMoCode in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up MiMoCode

- **WHEN** a user or machine consumer looks up the canonical agent name `mimo` or the aliases `mimocode` or `mimo-code`
- **THEN** Quantex returns a supported agent entry for MiMoCode
- **AND** the entry identifies `mimo` as the executable binary
- **AND** the entry identifies `@mimo-ai/cli` as its npm package metadata
- **AND** the entry identifies `https://github.com/XiaomiMiMo/MiMo-Code` as the homepage

#### Scenario: Installing MiMoCode through supported methods

- **WHEN** Quantex renders or executes install options for MiMoCode
- **THEN** Windows, macOS, and Linux include the npm-compatible managed install method
- **AND** macOS and Linux include the official shell installer option (`curl -fsSL https://mimo.xiaomi.com/install | bash`)
- **AND** Windows does not include a script install method because upstream does not document a native PowerShell installer

#### Scenario: Probing MiMoCode version

- **WHEN** Quantex probes the installed version of MiMoCode
- **THEN** it runs `mimo --version` and parses the output

#### Scenario: Planning MiMoCode updates

- **WHEN** Quantex plans an update for a MiMoCode installation
- **THEN** the catalog does not expose a dedicated self-update command because upstream documentation does not describe one

### Requirement: Crush MUST be a supported lifecycle agent

Quantex SHALL include Crush (by Charmbracelet) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Crush

- **WHEN** a user or machine consumer looks up the canonical agent name `crush`
- **THEN** Quantex returns a supported agent entry for Crush
- **AND** the entry identifies `crush` as the executable binary
- **AND** the entry identifies `@charmland/crush` as its npm package metadata
- **AND** the entry identifies `https://github.com/charmbracelet/crush` as the homepage

#### Scenario: Installing Crush through supported methods

- **WHEN** Quantex renders or executes install options for Crush
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the Homebrew tap install method (`charmbracelet/tap/crush`)
- **AND** Windows includes the winget install method (`charmbracelet.crush`)

#### Scenario: Probing Crush version

- **WHEN** Quantex probes the installed version of Crush
- **THEN** it runs `crush --version` and parses the output

#### Scenario: Planning Crush updates

- **WHEN** Quantex plans an update for a Crush installation that supports self-update
- **THEN** the catalog exposes `crush update` as the agent self-update command

### Requirement: Amp MUST be a supported lifecycle agent

Quantex SHALL include Amp (by Sourcegraph) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Amp

- **WHEN** a user or machine consumer looks up the canonical agent name `amp`
- **THEN** Quantex returns a supported agent entry for Amp
- **AND** the entry identifies `amp` as the executable binary
- **AND** the entry identifies `@sourcegraph/amp` as its npm package metadata
- **AND** the entry identifies `https://ampcode.com/` as the homepage

#### Scenario: Installing Amp through supported methods

- **WHEN** Quantex renders or executes install options for Amp
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms

#### Scenario: Probing Amp version

- **WHEN** Quantex probes the installed version of Amp
- **THEN** it runs `amp version` and parses the output

#### Scenario: Planning Amp updates

- **WHEN** Quantex plans an update for an Amp installation that supports self-update
- **THEN** the catalog exposes `amp update` as the agent self-update command

### Requirement: Goose MUST be a supported lifecycle agent

Quantex SHALL include Goose (by Block) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Goose

- **WHEN** a user or machine consumer looks up the canonical agent name `goose`
- **THEN** Quantex returns a supported agent entry for Goose
- **AND** the entry identifies `goose` as the executable binary
- **AND** the entry identifies `https://github.com/aaif-goose/goose` as the homepage

#### Scenario: Installing Goose through supported methods

- **WHEN** Quantex renders or executes install options for Goose
- **THEN** macOS and Linux include the official curl install script option and the Homebrew formula install method (`block-goose-cli`)
- **AND** Windows includes the official curl install script option (Git Bash / MSYS2) and the PowerShell install script option (downloaded from raw.githubusercontent.com)

#### Scenario: Probing Goose version

- **WHEN** Quantex probes the installed version of Goose
- **THEN** it runs `goose --version` and parses the output

#### Scenario: Planning Goose updates

- **WHEN** Quantex plans an update for a Goose installation that supports self-update
- **THEN** the catalog exposes `goose update` as the agent self-update command

### Requirement: Grok Build MUST be a supported lifecycle agent

Quantex SHALL include Grok Build in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Grok Build

- **WHEN** a user or machine consumer looks up the canonical agent name `grok` or the alias `grok-build`
- **THEN** Quantex returns a supported agent entry for Grok Build
- **AND** the entry identifies `grok` as the executable binary
- **AND** the entry identifies `https://docs.x.ai/build/overview` as the homepage
- **AND** the entry does not claim the `agent` lookup alias already used by Cursor CLI

#### Scenario: Installing Grok Build through supported methods

- **WHEN** Quantex renders or executes install options for Grok Build
- **THEN** macOS and Linux include the official current curl install script option (`curl -fsSL https://x.ai/cli/install.sh | bash`)
- **AND** Windows includes the official current PowerShell install script option (`irm https://x.ai/cli/install.ps1 | iex`)
- **AND** the entry does not invent npm, bun, or Homebrew managed install methods that upstream docs do not document

#### Scenario: Probing Grok Build version

- **WHEN** Quantex probes the installed version of Grok Build
- **THEN** it runs `grok --version` and parses the output

#### Scenario: Planning Grok Build updates

- **WHEN** Quantex plans an update for a Grok Build installation that supports self-update
- **THEN** the catalog exposes `grok update` as the agent self-update command

### Requirement: Junie CLI MUST be a supported lifecycle agent

Quantex SHALL include Junie CLI (by JetBrains) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Junie CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `junie`
- **THEN** Quantex returns a supported agent entry for Junie CLI
- **AND** the entry identifies `junie` as the executable binary
- **AND** the entry identifies `@jetbrains/junie` as its npm package metadata
- **AND** the entry identifies `https://junie.jetbrains.com/docs/junie-cli.html` as the homepage

#### Scenario: Installing Junie CLI through supported methods

- **WHEN** Quantex renders or executes install options for Junie CLI
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official curl install script option and the Homebrew tap formula install method (`jetbrains-junie/junie/junie`)
- **AND** Windows includes the official PowerShell install script option (`iex (irm 'https://junie.jetbrains.com/install.ps1')`)

#### Scenario: Probing Junie CLI version

- **WHEN** Quantex probes the installed version of Junie CLI
- **THEN** it runs `junie --version` and parses the output

#### Scenario: Planning Junie CLI updates

- **WHEN** Quantex plans an update for a Junie CLI installation
- **THEN** the catalog does not expose a self-update command because upstream documentation describes automated update checks rather than a dedicated update subcommand

### Requirement: Kilo CLI MUST use the current supported display name

Quantex SHALL expose the Kilo catalog entry with the display name `Kilo CLI` while keeping the canonical agent slug `kilo`.

#### Scenario: Rendering Kilo metadata

- **WHEN** a user or machine consumer inspects the supported `kilo` agent entry
- **THEN** Quantex reports the display name `Kilo CLI`
- **AND** the entry continues to identify `kilo` as the canonical agent name and executable binary

### Requirement: Kiro CLI MUST be a supported lifecycle agent

Quantex SHALL include Kiro CLI (by Amazon) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, and stable identification.

#### Scenario: Looking up Kiro CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `kiro` or the alias `kiro-cli`
- **THEN** Quantex returns a supported agent entry for Kiro CLI
- **AND** the entry identifies `kiro-cli` as the executable binary

#### Scenario: Installing Kiro CLI through supported methods

- **WHEN** Quantex renders or executes install options for Kiro CLI
- **THEN** macOS and Linux include the official curl install script option (`curl -fsSL https://cli.kiro.dev/install | bash`)
- **AND** Windows includes the official PowerShell install script option (`irm 'https://cli.kiro.dev/install.ps1' | iex`)

#### Scenario: Probing Kiro CLI version

- **WHEN** Quantex probes the installed version of Kiro CLI
- **THEN** it runs `kiro-cli --version` and parses the output

#### Scenario: Planning Kiro CLI updates

- **WHEN** Quantex plans an update for a Kiro CLI installation
- **THEN** the catalog does not expose a self-update command because Kiro CLI auto-updates in the background

### Requirement: CodeWhale MUST be a supported lifecycle agent

Quantex SHALL include CodeWhale in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up CodeWhale

- **WHEN** a user or machine consumer looks up the canonical agent name `codewhale`
- **THEN** Quantex returns a supported agent entry for CodeWhale
- **AND** the entry identifies `codewhale` as the executable binary
- **AND** the entry identifies `codewhale` as its npm package metadata
- **AND** the entry identifies `https://github.com/Hmbown/CodeWhale` as the homepage

#### Scenario: Rejecting old DeepSeek TUI lookup names

- **WHEN** a user or machine consumer looks up `deepseek` or `deepseek-tui`
- **THEN** Quantex does not return a supported agent entry for those names

#### Scenario: Installing CodeWhale through supported methods

- **WHEN** Quantex renders or executes install options for CodeWhale
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux

#### Scenario: Probing CodeWhale version

- **WHEN** Quantex probes the installed version of CodeWhale
- **THEN** it runs `codewhale --version` and parses the output

#### Scenario: Planning CodeWhale updates

- **WHEN** Quantex plans an update for a CodeWhale installation that supports self-update
- **THEN** the catalog exposes `codewhale update` as the agent self-update command

### Requirement: Antigravity CLI MUST be a supported lifecycle agent
Quantex SHALL include Google Antigravity CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Antigravity CLI
- **WHEN** a user or machine consumer looks up the canonical agent name `antigravity` or the aliases `agy` or `antigravity-cli`
- **THEN** Quantex returns a supported agent entry for Antigravity CLI
- **AND** the entry identifies `agy` as the executable binary
- **AND** the entry identifies `https://antigravity.google/product/antigravity-cli` as the homepage

#### Scenario: Installing Antigravity CLI through supported methods
- **WHEN** Quantex renders or executes install options for Antigravity CLI
- **THEN** macOS and Linux include the official shell installer option (`curl -fsSL https://antigravity.google/cli/install.sh | bash`)
- **AND** Windows includes the official PowerShell installer option (`irm https://antigravity.google/cli/install.ps1 | iex`)

#### Scenario: Probing Antigravity CLI version
- **WHEN** Quantex probes the installed version of Antigravity CLI
- **THEN** it runs `agy --version` and parses the output

#### Scenario: Planning Antigravity CLI updates
- **WHEN** Quantex plans an update for an Antigravity CLI installation that supports self-update
- **THEN** the catalog exposes `agy update` as the agent self-update command

### Requirement: Hermes Agent MUST be a supported lifecycle agent

Quantex SHALL include Hermes Agent in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Hermes Agent

- **WHEN** a user or machine consumer looks up the canonical agent name `hermes` or the alias `hermes-agent`
- **THEN** Quantex returns a supported agent entry for Hermes Agent
- **AND** the entry identifies `hermes` as the executable binary
- **AND** the entry identifies `https://github.com/NousResearch/hermes-agent` as the homepage

#### Scenario: Installing Hermes Agent through supported methods

- **WHEN** Quantex renders or executes install options for Hermes Agent
- **THEN** macOS and Linux include the official native shell installer (`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`iex (irm https://hermes-agent.nousresearch.com/install.ps1)`)
- **AND** the entry does not include npm, Cargo, Homebrew, pip, uv, or winget managed install methods for fresh Hermes installs

#### Scenario: Probing Hermes Agent version

- **WHEN** Quantex probes the installed version of Hermes Agent
- **THEN** it runs `hermes --version` and parses the output

#### Scenario: Planning Hermes Agent updates

- **WHEN** Quantex plans an update for a Hermes Agent installation that supports the built-in updater
- **THEN** the catalog exposes `hermes update` as the agent self-update command

### Requirement: OpenClaw MUST be a supported lifecycle agent

Quantex SHALL include OpenClaw in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up OpenClaw

- **WHEN** a user or machine consumer looks up the canonical agent name `openclaw`
- **THEN** Quantex returns a supported agent entry for OpenClaw
- **AND** the entry identifies `openclaw` as the executable binary
- **AND** the entry identifies `openclaw` as its npm package metadata
- **AND** the entry identifies `https://github.com/openclaw/openclaw` as the homepage

#### Scenario: Installing OpenClaw through supported methods

- **WHEN** Quantex renders or executes install options for OpenClaw
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official native shell installer (`curl -fsSL https://openclaw.ai/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`iwr -useb https://openclaw.ai/install.ps1 | iex`)

#### Scenario: Probing OpenClaw version

- **WHEN** Quantex probes the installed version of OpenClaw
- **THEN** it runs `openclaw --version` and parses the output

#### Scenario: Planning OpenClaw updates

- **WHEN** Quantex plans an update for an OpenClaw installation that supports the built-in updater
- **THEN** the catalog exposes `openclaw update` as the agent self-update command

### Requirement: Command Code MUST be a supported lifecycle agent

Quantex SHALL include Command Code in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Command Code

- **WHEN** a user or machine consumer looks up the canonical agent name `commandcode` or the aliases `command-code`, `cmd`, or `cmdc`
- **THEN** Quantex returns a supported agent entry for Command Code
- **AND** the entry identifies `command-code` as the executable binary
- **AND** the entry identifies `command-code` as its npm package metadata
- **AND** the entry identifies `https://commandcode.ai/docs/quickstart` as the homepage

#### Scenario: Installing Command Code through supported methods

- **WHEN** Quantex renders or executes install options for Command Code
- **THEN** the catalog includes the npm-compatible managed install method on Windows, macOS, and Linux
- **AND** the npm install command installs `command-code`

#### Scenario: Probing Command Code version

- **WHEN** Quantex probes the installed version of Command Code
- **THEN** it runs `command-code --version` and parses the output

#### Scenario: Planning Command Code updates

- **WHEN** Quantex plans an update for a Command Code installation that supports self-update
- **THEN** the catalog exposes `command-code update` as the agent self-update command

### Requirement: Install candidates MUST bind provider and package identity once

Each install candidate in the supported agent catalog MUST bind one provider identity to the exact provider-specific package, tool, formula, cask, script, or binary reference used by that candidate. Quantex SHALL preserve that binding through candidate selection and lifecycle receipts so later inspection, update, and uninstall work does not reconstruct identity from unrelated catalog fields.

#### Scenario: Selected candidate carries one bound lifecycle identity

- **GIVEN** an agent offers separate npm and Homebrew install candidates
- **AND** each candidate binds its own provider and provider-specific package identity
- **WHEN** Quantex selects the npm candidate for installation
- **THEN** the resulting lifecycle receipt identifies the npm provider and the npm package bound to that candidate
- **AND** later lifecycle planning does not substitute the Homebrew identity or infer a package from another candidate

### Requirement: Install candidates MUST expose declarative lifecycle probes

Each install candidate SHALL declare the provider and executable probes available for observing package presence, executable presence, installed version, and available target version. Quantex MUST treat an undeclared probe as an unsupported capability rather than inventing agent-specific probe behavior outside the catalog binding.

#### Scenario: Lifecycle observation uses candidate probe declarations

- **GIVEN** an install candidate declares provider-package presence and installed-version probes
- **WHEN** Quantex observes lifecycle state for an installation associated with that candidate
- **THEN** Quantex invokes the declared probes against the candidate's bound provider and package identity
- **AND** it does not infer live provider state solely from a receipt or executable presence in `PATH`

#### Scenario: Missing target-version probe remains explicit

- **GIVEN** an install candidate does not declare an available-target-version probe
- **WHEN** Quantex inspects the candidate's update capabilities
- **THEN** Quantex treats target-version discovery as unsupported for that candidate
- **AND** it does not fabricate a target version from unrelated package metadata

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

### Requirement: Catalog membership is a maintainer commitment that MAY be withdrawn

The supported agent catalog SHALL represent the set of agents Quantex commits to keeping installable, probeable, updatable, and canary-verified. Membership is not an archival record of every agent that has ever been supported. A maintainer MAY withdraw an entry when its adoption no longer justifies the standing support obligation, provided the withdrawal is recorded in an approved change that states the basis.

A withdrawal SHALL NOT be described as an upstream defect, deprecation, or abandonment unless the change records evidence for that claim. Withdrawing an entry SHALL NOT remove the install provider it used, because provider support is scoped to the provider, not to any catalog consumer. When the withdrawn name is part of the v1 root export snapshot, the symbol is retained as frozen data under `compatibility-contract`, so a withdrawal is not by itself a breaking change.

#### Scenario: Withdrawing an entry whose upstream is healthy

- **GIVEN** a catalog entry whose upstream project is actively maintained
- **WHEN** an approved change withdraws it for adoption reasons
- **THEN** the change records the measured adoption basis and the measurement date
- **AND** the change does not assert that the upstream project is abandoned, deprecated, or defective

#### Scenario: Withdrawing the last consumer of an install provider

- **GIVEN** a catalog entry is the only entry using a given install provider
- **WHEN** that entry is withdrawn
- **THEN** the provider implementation remains supported
- **AND** its behavior remains covered by tests that do not depend on catalog membership

#### Scenario: Looking up a withdrawn entry

- **WHEN** a user or machine consumer looks up a canonical name or alias that has been withdrawn
- **THEN** Quantex reports it as an unknown agent through the same path as any other unrecognized name
- **AND** no partial entry, placeholder, or tombstone appears in catalog listings or discovery output

#### Scenario: A user already installed a withdrawn agent

- **GIVEN** persisted state records an installation of an agent that has since been withdrawn
- **WHEN** Quantex reads that state
- **THEN** it preserves the record without rewriting or deleting it
- **AND** it reports the agent as untracked rather than failing the invocation

### Requirement: Catalog install methods MUST come from the eligible provider set

Quantex SHALL restrict supported agent catalog entries to install methods drawn from the eligible provider set: `bun`, `npm`, `brew`, `winget`, `script`, and `binary`. These cover the Node ecosystem and native binary distribution, including operating-system package managers that ship native binaries.

Catalog entries MUST NOT declare `cargo`, `mise`, `pip`, or `uv` install methods, and MUST NOT carry `packages` metadata whose only purpose is to describe one of those methods. An entry MUST offer at least one eligible install method on every platform it declares; a platform that would be left with no eligible method MUST be dropped from the entry rather than retained as a platform Quantex cannot install on.

Provider ineligibility is a catalog rule, not a provider removal. The `cargo`, `mise`, `pip`, and `uv` provider implementations SHALL remain available so an installation already recorded in state continues to resolve its managed update and uninstall path through the provider that produced it.

#### Scenario: Declaring an ineligible install method

- **WHEN** a catalog entry declares a `cargo`, `mise`, `pip`, or `uv` install method
- **THEN** the entry is rejected as outside the eligible provider set
- **AND** the rejection is independent of whether the upstream agent is genuinely distributed that way

#### Scenario: A platform is left with no eligible method

- **GIVEN** an entry whose only methods on one platform are ineligible
- **WHEN** the ineligible methods are removed
- **THEN** that platform is dropped from the entry
- **AND** the entry does not advertise a platform for which Quantex offers no install route

#### Scenario: Updating an agent installed through a now-ineligible provider

- **GIVEN** persisted state records an installation performed through `cargo`, `mise`, `pip`, or `uv`
- **WHEN** Quantex plans an update or uninstall for that agent
- **THEN** it resolves the recorded install type rather than the entry's current catalog methods
- **AND** the managed update and uninstall paths continue to work through the recorded provider

#### Scenario: Installing an agent fresh after its provider became ineligible

- **WHEN** a user installs an agent whose ineligible method was removed
- **THEN** Quantex offers only the entry's remaining eligible methods
- **AND** no ineligible method appears in rendered install options

### Requirement: OpenHands CLI MUST be a supported lifecycle agent

Quantex SHALL include OpenHands CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up OpenHands CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `openhands`
- **THEN** Quantex returns a supported agent entry for OpenHands CLI
- **AND** the entry identifies `openhands` as the executable binary
- **AND** the entry identifies `https://docs.openhands.dev/openhands/usage/cli/installation` as the homepage

#### Scenario: Installing OpenHands CLI through supported methods

- **WHEN** Quantex renders or executes install options for OpenHands CLI
- **THEN** macOS and Linux include the official install script (`curl -fsSL https://install.openhands.dev/install.sh | sh`)
- **AND** the script candidate declares the installed-version probe, so the credential-free canary verifies `openhands --version` evidence rather than executable presence alone
- **AND** the entry does not advertise a native Windows install method, because upstream CLI docs route Windows users through WSL

#### Scenario: Probing OpenHands CLI version

- **WHEN** Quantex probes the installed version of OpenHands CLI
- **THEN** it runs `openhands --version` and parses the output

#### Scenario: Planning an OpenHands CLI update

- **GIVEN** the entry declares no self-update command, because its official installer downloads a standalone release binary rather than registering a `uv` tool
- **WHEN** Quantex plans an update for an OpenHands CLI installation that it did not record as managed
- **THEN** it reports manual update guidance
- **AND** it does not run a package-manager upgrade command that would target a different installation than the one on disk

### Requirement: Mistral Vibe MUST be a supported lifecycle agent

Quantex SHALL include Mistral Vibe in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up Mistral Vibe

- **WHEN** a user or machine consumer looks up the canonical agent name `vibe` or the alias `mistral-vibe`
- **THEN** Quantex returns a supported agent entry for Mistral Vibe
- **AND** the entry identifies `vibe` as the executable binary
- **AND** the entry identifies `https://docs.mistral.ai/mistral-vibe/terminal/install` as the homepage

#### Scenario: Installing Mistral Vibe through supported methods

- **WHEN** Quantex renders or executes install options for Mistral Vibe
- **THEN** macOS and Linux include the official shell installer (`curl -fsSL https://mistral.ai/vibe/install.sh | bash`)
- **AND** the script candidate declares the installed-version probe, so the credential-free canary verifies `vibe --version` evidence rather than executable presence alone
- **AND** the entry declares no Windows platform, because upstream publishes only Python-toolchain installers for Windows and those providers are outside the eligible set

#### Scenario: Probing Mistral Vibe version

- **WHEN** Quantex probes the installed version of Mistral Vibe
- **THEN** it runs `vibe --version` and parses the output

