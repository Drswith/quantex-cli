# product-readme Specification

## Purpose
Define product-facing README structure, content priorities, and installation guidance for the repository landing page.
## Requirements
### Requirement: README Presents Quantex As A Product

The root README SHALL prioritize product-facing information before maintainer workflow, project memory, or process documentation, and it MUST do so in English for the default repository landing page.

#### Scenario: New user opens README

- **WHEN** a user opens `README.md`
- **THEN** the first major sections explain in English what Quantex is, why it is useful, how to install it, and how to run common commands

### Requirement: README Supports Language Switching

The product README experience SHALL provide English and Simplified Chinese entry points with visible language switch links near the top of each full product README page. The default root landing page MUST be English-first.

#### Scenario: User switches README language

- **WHEN** a user opens `README.md` or `README.zh-CN.md`
- **THEN** the page provides links for English and Simplified Chinese versions
- **AND** `README.md` is the primary English product landing page

### Requirement: README Shows Product Badges

The product README SHALL show concise status and popularity badges near the top, including GitHub star count.

#### Scenario: User scans project health

- **WHEN** a user opens the README landing area
- **THEN** they can see package, CI/release, license, and star-count badges before reading setup instructions.

### Requirement: README Provides Agent Bootstrap Guidance

The product README SHALL include an agent-friendly bootstrap section that provides copyable `npx skills` installation commands, Quantex discovery commands, and repository context entry points for coding agents.

#### Scenario: Coding agent starts from README

- **WHEN** a coding agent or user-controlled agent reads the README
- **THEN** it can find the commands and documents needed to discover Quantex capabilities and follow the repository workflow.

### Requirement: README Keeps Internal Knowledge Discoverable

The root README SHALL link to maintainer, OpenSpec, release, and agent-facing documentation without making those topics the primary reading path.

#### Scenario: Maintainer needs workflow details

- **WHEN** a maintainer or coding agent needs process documentation
- **THEN** `README.md` provides concise links to the appropriate `docs/` or `openspec/` entry points.

### Requirement: README Examples Match Current CLI Surface

The root README MUST use command examples and supported-agent references that match the current Quantex CLI surface, including current agent catalog entries and built-in configuration defaults.

#### Scenario: User copies a README command

- **WHEN** a user copies an install, inspect, ensure, update, upgrade, or execution example from `README.md`
- **THEN** the command reflects an existing Quantex command or documented alias.

#### Scenario: User reviews supported agents

- **WHEN** a user reads the supported-agent table in `README.md` or `README.zh-CN.md`
- **THEN** the documented agent names and shortcut commands reflect the current Quantex agent catalog.

#### Scenario: User reviews default configuration

- **WHEN** a user reads the configuration example in `README.md` or `README.zh-CN.md`
- **THEN** the documented values reflect built-in defaults unless the text explicitly labels a value as an optional override.

### Requirement: README Recommends The Preferred Short Entry Point

The product README SHALL present `qtx` as the recommended short command entry point for human-facing onboarding while explicitly identifying `quantex` as the equivalent long-form command.

#### Scenario: User scans the onboarding path

- **WHEN** a user reads the install, quick start, or supported-agent sections in `README.md` or `README.en.md`
- **THEN** the primary examples use `qtx` for the shortest copyable path
- **AND** the documentation states that `qtx` and `quantex` are equivalent entry points

### Requirement: README warns that self-upgrade follows the active registry

The product README SHALL explain that `qtx upgrade` uses the registry selected for the current Bun/npm self-upgrade path and that mirrors can lag behind the official npm release.

#### Scenario: User reads upgrade guidance while using a mirror

- **WHEN** a user reads the installation or upgrade guidance in `README.md` or `README.en.md`
- **THEN** the documentation explains that `qtx upgrade` follows the active Bun/npm registry
- **AND** it warns that a lagging mirror can delay installation of the newest upstream release

### Requirement: README Documents Verified Read-Only No-Install Usage

The product README SHALL include a first-class no-install try-it-out section that promotes only read-only or discovery-oriented commands and uses command forms verified against the published package behavior.

#### Scenario: User evaluates Quantex without a global install

- **WHEN** a user opens the no-install try-it-out section
- **THEN** the README shows copyable commands for read-only surfaces such as `list`, `info`, `inspect`, `doctor`, `capabilities`, `commands`, or `schema`
- **AND** each recommended package-manager form matches a currently working invocation for the published package
- **AND** the section states any current runtime prerequisite needed to execute those commands

#### Scenario: User looks for mutating no-install commands

- **WHEN** a user reads the no-install try-it-out guidance
- **THEN** the README directs install, update, uninstall, and other state-writing flows back to the normal installation paths instead of promoting them as first-class no-install usage

### Requirement: README Distinguishes User Skill From Contributor Runtime

The product README SHALL distinguish the user-facing Quantex CLI skill from the contributor-facing Quantex agent runtime skill.

#### Scenario: User installs a Quantex skill from README

- **WHEN** a user reads the agent quick start or skill installation guidance
- **THEN** the normal skill installation path points to `skills/quantex-cli`
- **AND** the documentation does not present `skills/quantex-agent-runtime` as a general user-facing skill

#### Scenario: Contributor starts repository work

- **WHEN** a contributor or coding agent is working inside this repository
- **THEN** the repository workflow guidance may direct them to `skills/quantex-agent-runtime`
- **AND** the guidance identifies it as repository development runtime rather than the public Quantex operation skill

### Requirement: Product README MUST document mise agent installer support

The product README SHALL explain that mise is supported as an agent lifecycle installer when an agent definition exposes a mise install method, and SHALL show `mise` as a valid `defaultPackageManager` preference.

#### Scenario: User reviews configuration docs

- **WHEN** a user reads the configuration section of the product README
- **THEN** the default package-manager guidance includes `mise` as an option for agent lifecycle installs
- **AND** the self-upgrade guidance remains scoped to Bun, npm, and standalone binary sources

### Requirement: README documents the public Core SDK identity

The product README SHALL document `quantex-core` as the installable TypeScript SDK and SHALL use only its public root import in examples. It MUST distinguish Core npm publication from the independent CLI release path.

#### Scenario: a TypeScript consumer follows the SDK guide
- **WHEN** the consumer reads the English or Simplified Chinese README
- **THEN** it can install `quantex-core` and import `createQuantex` from `quantex-core`
- **AND** it is not instructed to use the provisional scoped identity

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.12
continues the staged Core rebuild by making in-repo Core the only CLI engine
for `install`, `ensure`, `update`, and `uninstall`, by observing CLI `inspect`,
`info`, `resolve`, and `list` through in-repo Core read ports, by launching CLI
`exec` / shortcut through an in-repo Core execution engine, by installing a
missing agent for authorized `exec --install` through the same Core
install/ensure engine as CLI install/ensure, and by diagnosing CLI `doctor`
through an in-repo Core diagnosis engine. They MUST state that the published
`quantex-core` SDK does not gain methods from this CLI promotion, that
package/binary/state identities remain v1-compatible, that install/ensure
`--dry-run` retains the maintained v1 planning path without lifecycle mutation,
and that the former `QUANTEX_INSTALLATION_ENGINE=legacy` install/ensure apply
escape is retired.

#### Scenario: a user reads either product README during the 1.12 slice

- **WHEN** a user reads either product README after the 1.12 CLI Core slices
- **THEN** it identifies `install`, `ensure`, `update`, and `uninstall` as
  Core-only CLI operations
- **AND THEN** it identifies `inspect`, `info`, `resolve`, and `list` as
  Core-backed CLI read observation commands
- **AND THEN** it identifies `exec` and shortcut launch as Core-backed CLI
  execution
- **AND THEN** it identifies authorized `exec --install` missing-agent
  mutation as sharing the Core install/ensure engine
- **AND THEN** it identifies `doctor` as a Core-backed CLI diagnosis command
- **AND THEN** it does not document `QUANTEX_INSTALLATION_ENGINE=legacy` as a
  supported install/ensure recovery route
- **AND THEN** it does not imply that the published SDK added methods because
  of those CLI routes

### Requirement: Product README MUST document uv agent installer preference

The English and Simplified Chinese product READMEs SHALL explain that uv is supported as an agent lifecycle installer when an agent definition exposes a uv method, and SHALL show `uv` as a valid `defaultPackageManager` preference without implying that Quantex installs uv automatically.

#### Scenario: User reviews uv configuration guidance

- **WHEN** a user reads the configuration section of either product README
- **THEN** the default package-manager guidance includes `uv` as an option for agent lifecycle installs
- **AND** the guidance states that the corresponding package-manager executable must already be available
- **AND** self-upgrade guidance remains scoped to its existing supported sources

