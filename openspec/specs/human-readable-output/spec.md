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
version and lifecycle information over verbose source evidence.

#### Scenario: List agents at a typical terminal width

- **WHEN** a user runs `qtx list` or `qtx ls` in human mode at a typical terminal width
- **THEN** Quantex displays aligned agent, installed-state, version, `Managed`, and `Available` columns when they fit
- **AND** `Managed` identifies the update path rather than update availability
- **AND** `Available` shows the observed target version only when it is semantically newer than the installed version
- **AND** displays a concise installed/not-installed summary

#### Scenario: An update is not confirmed

- **WHEN** an installed agent has an unavailable, equal, older, unknown, or non-comparable latest version
- **THEN** Quantex renders no available-update claim for that agent

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

