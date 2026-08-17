## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: VTCode MUST be a supported lifecycle agent

Quantex SHALL include VTCode in the supported agent catalog with
lifecycle-focused metadata for installation, inspection, resolution, execution,
update planning, and stable identification.

#### Scenario: Looking up VTCode

- **WHEN** a user or machine consumer looks up the canonical agent name `vtcode`
- **THEN** Quantex returns a supported agent entry for VTCode
- **AND** the entry identifies `vtcode` as the executable binary
- **AND** the entry identifies `https://github.com/vinhnx/vtcode` as the homepage

#### Scenario: Installing VTCode through supported methods

- **WHEN** Quantex renders or executes install options for VTCode
- **THEN** macOS and Linux include the official native shell installer (`curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`irm https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1 | iex`)
- **AND** macOS and Linux include the Homebrew formula install method (`vtcode`)

#### Scenario: Probing VTCode version

- **WHEN** Quantex probes the installed version of VTCode
- **THEN** it runs `vtcode --version` and parses the output

#### Scenario: Planning VTCode updates

- **WHEN** Quantex plans an update for a VTCode installation that supports the built-in updater
- **THEN** the catalog exposes `vtcode update` as the agent self-update command

## REMOVED Requirements

### Requirement: Cargo install methods MUST be supported lifecycle metadata

**Reason**: Cargo is outside the eligible provider set defined by `Catalog install methods MUST come from the eligible provider set`. The catalog no longer reaches into the Rust toolchain to install agents, so a requirement permitting entries to declare Cargo methods no longer describes supported behavior.

**Migration**: `codewhale` installs through `npm` and `vtcode` through its official install script or Homebrew. Installations already recorded as `cargo` keep updating and uninstalling through the retained `cargo` provider; no user action is required. To install a Rust-distributed agent outside the catalog, run `cargo install <crate>` directly.

### Requirement: CodeWhale Cargo metadata MUST be supported lifecycle metadata

**Reason**: This requirement exists only to pin CodeWhale's Cargo crate metadata and `--locked` install argument, both of which are removed with the Cargo method itself.

**Migration**: Install CodeWhale with `npm i -g codewhale`, which the entry continues to declare on Windows, macOS, and Linux. An existing `cargo`-installed CodeWhale keeps its managed update and uninstall path.

### Requirement: uv tool install methods MUST be supported lifecycle metadata

**Reason**: uv is outside the eligible provider set. The catalog no longer reaches into the Python toolchain to install agents.

**Migration**: `openhands` installs through its official install script on macOS and Linux. `vibe` installs through its official shell installer on macOS and Linux, and no longer declares a Windows platform because its only Windows routes were `uv` and `pip`; Windows users install Mistral Vibe directly with `uv tool install mistral-vibe`. Installations already recorded as `uv` keep updating and uninstalling through the retained `uv` provider.

### Requirement: mise install methods MUST be supported lifecycle metadata

**Reason**: mise is outside the eligible provider set. The catalog no longer routes installation through a polyglot version manager.

**Migration**: `codex` installs through `bun` or `npm` on all platforms, and additionally through Homebrew on macOS and Linux. An existing `mise`-installed Codex keeps its managed update and uninstall path.
