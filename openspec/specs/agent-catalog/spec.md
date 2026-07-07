# agent-catalog Specification

## Purpose
TBD - created by archiving change remove-agent-description-metadata. Update Purpose after archive.
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

### Requirement: ForgeCode MUST be a supported lifecycle agent

Quantex SHALL include ForgeCode (by Antinomy) in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up ForgeCode

- **WHEN** a user or machine consumer looks up the canonical agent name `forgecode` or the alias `forge`
- **THEN** Quantex returns a supported agent entry for ForgeCode
- **AND** the entry identifies `forge` as the executable binary
- **AND** the entry identifies `forgecode` as its npm package metadata
- **AND** the entry identifies `https://forgecode.dev` as the homepage

#### Scenario: Installing ForgeCode through supported methods

- **WHEN** Quantex renders or executes install options for ForgeCode
- **THEN** the catalog includes npm-compatible and bun-compatible managed install methods on all platforms
- **AND** macOS and Linux include the official curl install script option
- **AND** Windows includes the official PowerShell install script option

#### Scenario: Probing ForgeCode version

- **WHEN** Quantex probes the installed version of ForgeCode
- **THEN** it runs `forge --version` and parses the output

#### Scenario: Planning ForgeCode updates

- **WHEN** Quantex plans an update for a ForgeCode installation that supports self-update
- **THEN** the catalog exposes `forge update` as the agent self-update command

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

### Requirement: VTCode MUST be a supported lifecycle agent

Quantex SHALL include VTCode in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up VTCode

- **WHEN** a user or machine consumer looks up the canonical agent name `vtcode`
- **THEN** Quantex returns a supported agent entry for VTCode
- **AND** the entry identifies `vtcode` as the executable binary
- **AND** the entry identifies `vtcode` as its Cargo crate metadata
- **AND** the entry identifies `https://github.com/vinhnx/vtcode` as the homepage

#### Scenario: Installing VTCode through supported methods

- **WHEN** Quantex renders or executes install options for VTCode
- **THEN** the catalog includes the Cargo managed install method on Windows, macOS, and Linux
- **AND** Windows orders the Cargo managed install method before the official native PowerShell installer while upstream Windows release assets are absent
- **AND** macOS and Linux include the official native shell installer (`curl -fsSL https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.sh | bash`)
- **AND** Windows includes the official native PowerShell installer (`irm https://raw.githubusercontent.com/vinhnx/vtcode/main/scripts/install.ps1 | iex`)
- **AND** macOS and Linux include the Homebrew formula install method (`vtcode`)

#### Scenario: Probing VTCode version

- **WHEN** Quantex probes the installed version of VTCode
- **THEN** it runs `vtcode --version` and parses the output

#### Scenario: Planning VTCode updates

- **WHEN** Quantex plans an update for a VTCode installation that supports the built-in updater
- **THEN** the catalog exposes `vtcode update` as the agent self-update command

### Requirement: Cargo install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare Cargo-managed install methods and crate package metadata when an upstream agent is distributed as a Rust crate.

#### Scenario: Registering Cargo package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed as a Rust crate
- **THEN** the entry can identify the crate through `packages.cargo`
- **AND** the entry can include Cargo managed install methods on platforms where the crate is supported
- **AND** Cargo package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering Cargo install guidance

- **WHEN** Quantex renders install methods for an agent with a Cargo managed install method
- **THEN** the install method is labeled as a managed Cargo install
- **AND** the command guidance uses `cargo install <crate>`

#### Scenario: Registering DeepSeek TUI Cargo metadata

- **WHEN** Quantex defines the supported DeepSeek TUI agent entry
- **THEN** the entry identifies `deepseek-tui-cli` as Cargo package metadata
- **AND** the Cargo install method includes the upstream-documented `--locked` argument
- **AND** the entry continues to identify `deepseek-tui` as npm package metadata

### Requirement: uv tool install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare uv tool managed install methods and uv package metadata when an upstream agent is distributed through `uv tool install`.

#### Scenario: Registering uv package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed through `uv tool install`
- **THEN** the entry can identify the tool package through `packages.uv`
- **AND** the entry can include uv managed install methods on platforms where the package is supported
- **AND** uv package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering uv install guidance

- **WHEN** Quantex renders install methods for an agent with a uv managed install method
- **THEN** the install method is labeled as a managed uv install
- **AND** the command guidance uses `uv tool install <package>`
- **AND** package-specific uv install arguments are preserved in the rendered command

#### Scenario: Registering OpenHands uv metadata

- **WHEN** Quantex defines the supported OpenHands CLI agent entry
- **THEN** the entry identifies `openhands` as uv package metadata
- **AND** macOS and Linux include the uv managed install method with the upstream-documented `--python 3.12` argument
- **AND** the entry continues to include the official install script option
- **AND** the entry does not advertise a native Windows install method because upstream CLI docs route Windows users through WSL

#### Scenario: Registering Mistral Vibe uv metadata

- **WHEN** Quantex defines the supported Mistral Vibe agent entry
- **THEN** the entry identifies `mistral-vibe` as uv package metadata
- **AND** macOS, Linux, and Windows include a uv managed install method
- **AND** the entry continues to identify `mistral-vibe` as pip package metadata
- **AND** macOS and Linux continue to include the official shell installer option

### Requirement: mise install methods MUST be supported lifecycle metadata

Quantex SHALL allow supported agent catalog entries to declare mise-managed install methods and mise package metadata when an upstream agent can be installed through mise.

#### Scenario: Registering mise package metadata

- **WHEN** Quantex defines or updates a supported agent entry that is distributed through mise
- **THEN** the entry can identify the mise tool reference through `packages.mise`
- **AND** the entry can include mise managed install methods on platforms where that mise tool reference is supported
- **AND** mise package metadata is treated as lifecycle metadata, not descriptive marketing copy

#### Scenario: Rendering mise install guidance

- **WHEN** Quantex renders install methods for an agent with a mise managed install method
- **THEN** the install method is labeled as a managed mise install
- **AND** the command guidance uses `mise use --global <tool-ref>`

#### Scenario: Registering Codex CLI mise metadata

- **WHEN** Quantex defines the Codex CLI agent entry
- **THEN** the entry identifies `npm:@openai/codex` as mise package metadata
- **AND** Windows, macOS, and Linux include a mise managed install method
- **AND** the entry continues to identify `@openai/codex` as npm package metadata

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

### Requirement: CodeWhale Cargo metadata MUST be supported lifecycle metadata

Quantex SHALL record CodeWhale's Cargo package metadata when defining the supported CodeWhale agent entry.

#### Scenario: Registering CodeWhale Cargo metadata

- **WHEN** Quantex defines the supported CodeWhale agent entry
- **THEN** the entry identifies `codewhale-cli` as Cargo package metadata
- **AND** the Cargo install method includes the upstream-documented `--locked` argument
- **AND** the entry identifies `codewhale` as npm package metadata

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

