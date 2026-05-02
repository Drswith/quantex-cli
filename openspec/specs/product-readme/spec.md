# product-readme Specification

## Purpose
TBD - created by archiving change productize-readme. Update Purpose after archive.
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

The root README MUST use command examples and supported-agent references that match the current Quantex CLI surface.

#### Scenario: User copies a README command

- **WHEN** a user copies an install, inspect, ensure, update, upgrade, or execution example from `README.md`
- **THEN** the command reflects an existing Quantex command or documented alias.

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

