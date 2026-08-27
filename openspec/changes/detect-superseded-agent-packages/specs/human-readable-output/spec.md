## MODIFIED Requirements

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
