<!-- Imported from openspec/specs/agent-catalog/spec.md at v1.13.6 (commit cf89c6c7). Reference material for the Rust build; contract tests and contract/cli/*.json take precedence. -->

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

### Requirement: Kilo CLI MUST use the current supported display name

Quantex SHALL expose the Kilo catalog entry with the display name `Kilo CLI` while keeping the canonical agent slug `kilo`.

#### Scenario: Rendering Kilo metadata

- **WHEN** a user or machine consumer inspects the supported `kilo` agent entry
- **THEN** Quantex reports the display name `Kilo CLI`
- **AND** the entry continues to identify `kilo` as the canonical agent name and executable binary

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
- **AND** the entry does not include managed install methods for fresh Hermes installs

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

Catalog candidates selected for credential-free lifecycle canaries, such as Devin, MUST declare the installed-version probe when their unauthenticated version command is available, so real canaries verify semantic version evidence rather than executable presence alone.

#### Scenario: Devin binary lifecycle route

- **WHEN** the official Devin installer has acquired the executable and account setup is deferred
- **THEN** its catalog probes require `devin version` evidence before Quantex reports the binary lifecycle as verified

### Requirement: Catalog membership is a maintainer commitment that MAY be withdrawn

The supported agent catalog SHALL represent the set of agents Quantex commits to keeping installable, probeable, updatable, and canary-verified. Membership is not an archival record of every agent that has ever been supported. A maintainer MAY withdraw an entry when its adoption no longer justifies the standing support obligation, provided the withdrawal is recorded in an approved change that states the basis.

A withdrawal SHALL NOT be described as an upstream defect, deprecation, or abandonment unless the change records evidence for that claim. 2.0.0-beta.2 withdrew Auggie CLI, Autohand Code CLI, CodeWhale, Gemini CLI, Goose, Junie CLI, Kiro CLI, Mistral Vibe, OpenHands CLI, Qwen Code, and Reasonix to keep the catalog small.

#### Scenario: Withdrawing an entry whose upstream is healthy

- **GIVEN** a catalog entry whose upstream project is actively maintained
- **WHEN** an approved change withdraws it for adoption reasons
- **THEN** the change records the measured adoption basis and the measurement date
- **AND** the change does not assert that the upstream project is abandoned, deprecated, or defective

#### Scenario: Looking up a withdrawn entry

- **WHEN** a user or machine consumer looks up a canonical name or alias that has been withdrawn
- **THEN** Quantex reports it as an unknown agent through the same path as any other unrecognized name
- **AND** no partial entry, placeholder, or tombstone appears in catalog listings or discovery output

#### Scenario: A user already installed a withdrawn agent

- **GIVEN** persisted state records an installation of an agent that has since been withdrawn
- **WHEN** Quantex reads that state
- **THEN** it preserves the record without rewriting or deleting it
- **AND** it reports the agent as untracked rather than failing the invocation

### Requirement: Catalog install methods MUST come from the supported provider set

Quantex SHALL restrict catalog entries to install methods from the providers it implements: `bun`, `npm`, `brew`, `winget`, `script`, and `binary`. An entry MUST offer at least one install method on every platform it declares; a platform with none MUST be dropped from the entry.

Quantex no longer implements the `cargo`, `deno`, `mise`, `pip`, and `uv` providers. A `state.json` record with one of those install types, written by an earlier release, is kept unchanged but not managed: the agent is treated as untracked, so `update` and `uninstall` do not act on it, and the record is written back as it was.

#### Scenario: Declaring an ineligible install method

- **WHEN** a catalog entry declares an install method outside the supported provider set
- **THEN** the entry is rejected by the catalog schema
- **AND** the rejection is independent of whether the upstream agent is genuinely distributed that way

#### Scenario: A platform is left with no eligible method

- **GIVEN** an entry whose only methods on one platform are unsupported
- **WHEN** the unsupported methods are removed
- **THEN** that platform is dropped from the entry
- **AND** the entry does not advertise a platform for which Quantex offers no install route

#### Scenario: A record from a removed provider

- **GIVEN** `state.json` records an agent with install type `uv`
- **WHEN** Quantex reads and later rewrites the state
- **THEN** the agent is reported as untracked rather than failing the invocation
- **AND** the record is written back unchanged

### Requirement: DeepSeek Harness MUST be a supported lifecycle agent

Quantex SHALL include DeepSeek Harness in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up DeepSeek Harness

- **WHEN** a user or machine consumer looks up the canonical agent name `dsh` or the alias `deepseek-harness`
- **THEN** Quantex returns a supported agent entry for DeepSeek Harness
- **AND** the entry identifies `dsh` as the executable binary
- **AND** the entry identifies `@deepseek-ai/dsh` as its npm package metadata
- **AND** the entry identifies `https://github.com/deepseek-ai/deepseek-harness` as the homepage

#### Scenario: The bare DeepSeek lookup names stay unclaimed

- **WHEN** a user or machine consumer looks up `deepseek` or `deepseek-tui`
- **THEN** Quantex still does not return a supported agent entry for those names
- **AND** adding DeepSeek Harness does not reclaim them, because its canonical name, alias, and display name are all distinct from them

#### Scenario: Installing DeepSeek Harness through supported methods

- **WHEN** Quantex renders or executes install options for DeepSeek Harness
- **THEN** Windows, macOS, and Linux each include the official npm managed install of `@deepseek-ai/dsh`
- **AND** the entry does not declare a `bun`, `brew`, `winget`, `script`, or `binary` method, because upstream documents Node.js with npm as its only distribution and publishes no release binary

#### Scenario: Probing DeepSeek Harness version

- **WHEN** Quantex probes the installed version of DeepSeek Harness
- **THEN** it runs `dsh --version` and parses the output

#### Scenario: Planning a DeepSeek Harness update

- **GIVEN** the entry declares no self-update command, because the launcher grammar exposes only profile boot, `web`, and `plugin`
- **WHEN** Quantex plans an update for a DeepSeek Harness installation
- **THEN** it resolves the recorded npm install source rather than running an agent self-update command
- **AND** an installation Quantex did not record as managed reports manual update guidance

### Requirement: Catalog entries MUST declare superseded package identifiers

When an agent's upstream distribution moves to a different package identifier, the catalog entry SHALL bind its install candidates to the current identifier and SHALL additionally declare the identifiers the agent was previously distributed under. Superseded identifiers SHALL be keyed by the same package-metadata provider keys that resolve current package metadata, so a recorded install can be matched against them without inferring provider identity. A catalog entry MUST NOT declare one identifier as both a current and a superseded package under the same provider key.

#### Scenario: Declaring a superseded package identifier

- **GIVEN** an agent whose upstream package identifier changed
- **WHEN** Quantex defines that agent's catalog entry
- **THEN** the entry's install candidates bind the current package identifier
- **AND** the entry declares the previous identifier as a superseded package under the provider key that resolves it

#### Scenario: Rejecting a contradictory superseded declaration

- **GIVEN** a catalog entry that declares one identifier as both a current package and a superseded package under the same provider key
- **WHEN** Quantex loads the catalog
- **THEN** Quantex rejects the entry rather than resolving an ambiguous package identity

#### Scenario: Entry without a distribution change

- **GIVEN** an agent whose upstream package identifier has not changed
- **WHEN** Quantex defines that agent's catalog entry
- **THEN** the entry declares no superseded packages
- **AND** Quantex treats the absent declaration as an assertion that no identifier is superseded, not as missing information

### Requirement: Pi MUST resolve lifecycle through its current upstream package

Quantex SHALL bind Pi's managed install candidates to `@earendil-works/pi-coding-agent` and SHALL declare `@mariozechner/pi-coding-agent` as a superseded npm package identifier. The superseded identifier is frozen upstream and its published release carries a deprecation notice naming the current package, so Quantex MUST NOT resolve Pi lifecycle versions from it.

#### Scenario: Installing Pi

- **WHEN** Quantex renders or executes install options for Pi
- **THEN** the bun and npm candidates on Windows, macOS, and Linux bind `@earendil-works/pi-coding-agent`
- **AND** the entry continues to identify `pi` as the executable binary

#### Scenario: Recognizing a Pi install recorded under the previous package

- **GIVEN** a recorded Pi install whose package identity is `@mariozechner/pi-coding-agent`
- **WHEN** Quantex resolves Pi's lifecycle metadata
- **THEN** Quantex identifies the recorded package as superseded by `@earendil-works/pi-coding-agent`

### Requirement: Cursor CLI catalog identity MUST stay `agent` while version probing prefers `cursor-agent`

Quantex SHALL keep Cursor CLI in the supported agent catalog with canonical name `cursor`, executable `binaryName` `agent`, and lookup alias `agent`. Lookup aliases MUST NOT include the canonical name `cursor`.

When locating Cursor CLI for version probing, Quantex SHALL try the more specific executable name `cursor-agent` before falling back to `agent`. That targeting rule is internal. The catalog entry, public `AgentVersionProbe` type, catalog schema, and v1 root declaration MUST NOT gain a preferred-binaries field or any other new member to carry it.

Structured `list` and `inspect` output SHALL continue to report `binaryName` as `agent`. Probe targeting names MUST NOT appear as a new CLI `--json` field.

#### Scenario: Looking up Cursor CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `cursor` or the alias `agent`
- **THEN** Quantex returns the Cursor CLI catalog entry
- **AND** the entry identifies `agent` as the executable `binaryName`
- **AND** the entry's lookup aliases are `agent` and do not include `cursor`
- **AND** the catalog entry has no preferred-binaries field

#### Scenario: Probing Cursor CLI version

- **WHEN** Quantex probes the installed version of Cursor CLI
- **THEN** it locates `cursor-agent` before falling back to `agent`
- **AND** it runs the catalog version-probe command against the resolved absolute path
- **AND** structured output still reports `binaryName` as `agent`

