## ADDED Requirements

### Requirement: README Presents Quantex As A Product

The root README SHALL prioritize product-facing information before maintainer workflow, project memory, or process documentation.

#### Scenario: New user opens README

- **WHEN** a user opens `README.md`
- **THEN** the first major sections explain what Quantex is, why it is useful, how to install it, and how to run common commands.

### Requirement: README Supports Language Switching

The product README experience SHALL provide Simplified Chinese and English entry points with visible language switch links near the top of each page.

#### Scenario: User switches README language

- **WHEN** a user opens either `README.md` or `README.en.md`
- **THEN** the page provides links for Simplified Chinese and English versions.

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
