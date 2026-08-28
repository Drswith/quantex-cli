# human-readable-output Specification

## Purpose
Define human-readable CLI output hierarchy, formatting, and status presentation for inventories, diagnostics, and detail views.
## Requirements
### Requirement: Human output uses a consistent visual hierarchy

Quantex SHALL render broad human-readable inventories, catalogs, diagnostics, and detail views with consistent headings, aligned fields or columns, restrained status color, and subordinate summaries or hints.

#### Scenario: Render a human-readable inventory

- **WHEN** a user runs an inventory or catalog command in human output mode
- **THEN** Quantex presents the primary identity and status information in aligned, scannable rows
- **AND** secondary guidance is visually separated from the primary rows

#### Scenario: Render an agent detail view

- **WHEN** a user runs a human-readable agent detail or resolution command
- **THEN** Quantex aligns field labels and wraps long values with hanging indentation

### Requirement: Human layout responds to terminal width

Quantex SHALL measure visible terminal width with ANSI and Unicode display semantics and SHALL intentionally degrade layouts before the terminal performs uncontrolled wrapping.

#### Scenario: Render a table in a wide terminal

- **WHEN** all declared table columns fit within the available terminal width
- **THEN** Quantex renders those columns with consistent visible alignment

#### Scenario: Render a table in a narrow terminal

- **WHEN** optional columns do not fit within the available terminal width
- **THEN** Quantex removes lower-priority optional columns before higher-priority columns
- **AND** preserves the primary identity and status fields

#### Scenario: Render content below the minimum natural width

- **WHEN** required content still exceeds the available width after optional columns are removed
- **THEN** Quantex bounds the rendered lines using ANSI-safe wrapping or ellipsis
- **AND** does not emit broken color sequences or mismeasure wide characters

### Requirement: Default inventory output prioritizes lifecycle summary

The default human-readable `list` output SHALL explicitly show each agent's
installation state and SHALL present update management separately from a
confirmed available newer version, while continuing to prioritize concise
version and lifecycle information over verbose source evidence. When an
installation cannot be compared against a target version because its recorded
package identity is superseded, the `Available` column SHALL say so rather than
render the same empty value it uses for an agent that is already current.

#### Scenario: List agents at a typical terminal width

- **WHEN** a user runs `qtx list` or `qtx ls` in human mode at a typical terminal width
- **THEN** Quantex displays aligned agent, installed-state, version, `Managed`, and `Available` columns when they fit
- **AND** `Managed` identifies the update path rather than update availability
- **AND** `Available` shows the observed target version only when it is semantically newer than the installed version
- **AND** displays a concise installed/not-installed summary

#### Scenario: An update is not confirmed

- **WHEN** an installed agent has an unavailable, equal, older, unknown, or non-comparable latest version
- **AND** the agent's recorded package identity is not superseded
- **THEN** Quantex renders no available-update claim for that agent

#### Scenario: An installation is bound to a superseded package

- **WHEN** an installed agent's recorded package identity is declared superseded by its catalog entry
- **THEN** `Available` marks that row as requiring migration instead of leaving it empty
- **AND** Quantex prints a warning below the table naming the recorded package, the current package, and the commands that complete the migration
- **AND** Quantex renders no available-update claim and no target version for that agent

#### Scenario: Source evidence is omitted from the default row

- **WHEN** the default human list is rendered
- **THEN** Quantex does not append verbose provider or package source evidence to every installed row
- **AND** shows an explicit hint to use `qtx inspect <agent>` for details

### Requirement: Broad human catalogs use progressive disclosure

Quantex SHALL summarize high-volume or machine-oriented detail in default human catalog output while providing an explicit path to the complete information.

#### Scenario: Inspect registered capability scope

- **WHEN** a user runs `qtx capabilities` in human mode
- **THEN** Quantex reports the number of registered agents instead of printing every agent identifier inline
- **AND** directs the user to `qtx list` for the inventory

#### Scenario: Inspect command contracts

- **WHEN** a user runs `qtx commands` in human mode
- **THEN** Quantex prioritizes command names and human summaries
- **AND** directs the user to structured command or schema discovery for full contract details

### Requirement: Machine-readable output remains unchanged

Quantex MUST preserve JSON and NDJSON payload fields, values, schemas, event routing, and exit behavior while human presentation changes.

#### Scenario: Request structured output from a migrated command

- **WHEN** a user requests JSON or NDJSON output from a command whose human renderer was redesigned
- **THEN** Quantex emits the same v1 structured result or event contract as before the redesign
- **AND** no human table, summary, or detail hint is mixed into structured standard output

### Requirement: Install-source evidence MUST describe the evidence Quantex holds

Human-readable install-source evidence SHALL describe what Quantex actually observed about an agent's origin. It MUST NOT name a resolution mechanism that Quantex did not use to locate the executable, and MUST NOT contradict the resolved executable path reported alongside it. When Quantex has no tracked install record for an agent whose executable it resolved, the source evidence SHALL report that the executable was detected on disk without attributing it to `PATH`.

#### Scenario: Untracked agent resolves only in a known install directory

- **GIVEN** an agent executable exists in a known install directory that is absent from the inherited `PATH`
- **AND** Quantex holds no install record for that agent
- **WHEN** a user runs a human-readable detail, resolution, inventory, or diagnostic command for that agent
- **THEN** the rendered source evidence reports the executable as detected on disk
- **AND** the rendered source evidence does not claim the executable was found in `PATH`

#### Scenario: Untracked agent resolves through PATH

- **GIVEN** an agent executable resolves through the inherited `PATH`
- **AND** Quantex holds no install record for that agent
- **WHEN** a user runs a human-readable detail, resolution, inventory, or diagnostic command for that agent
- **THEN** the rendered source evidence reports the executable as detected on disk
- **AND** the source evidence is identical to the evidence rendered for an agent resolved from a known install directory

#### Scenario: Tracked agent source evidence is unaffected

- **GIVEN** Quantex holds an install record for an agent
- **WHEN** a user runs a human-readable command that renders source evidence
- **THEN** the evidence continues to name the recorded install source

#### Scenario: Inventory source column for an untracked agent

- **WHEN** the human `list` Source column is rendered for an installed agent with no tracked install record
- **THEN** the column reports the agent as detected
- **AND** the column does not report `PATH` as the source

### Requirement: Untracked-agent guidance MUST NOT assert PATH membership

Warnings and hints that tell a user an agent is present but unmanaged SHALL describe the agent as detected rather than as present in `PATH`, so the guidance does not send a user to inspect a `PATH` that never contained the executable. Diagnostics about a package manager's own `PATH` membership are unaffected and MAY continue to reference `PATH` directly.

#### Scenario: Diagnostics warn about an untracked agent

- **GIVEN** Quantex resolves an agent executable it does not track
- **WHEN** Quantex emits its untracked-install diagnostic warning
- **THEN** the message describes the agent as detected but not tracked as a managed Quantex install
- **AND** the message does not assert that the agent is available in `PATH`

#### Scenario: Bulk update reports an untracked agent

- **GIVEN** a bulk update encounters an agent Quantex resolves but does not track
- **WHEN** Quantex emits the untracked-agent hint for that agent
- **THEN** the hint describes the agent as detected but not tracked
- **AND** the hint does not assert that the agent is available in `PATH`

#### Scenario: A tracked package manager is genuinely missing from PATH

- **GIVEN** Quantex is recorded as installed through a package manager
- **AND** that package manager's own executable does not resolve through `PATH`
- **WHEN** Quantex emits the missing-installer diagnostic
- **THEN** the message continues to state that the package manager is not available in `PATH`

