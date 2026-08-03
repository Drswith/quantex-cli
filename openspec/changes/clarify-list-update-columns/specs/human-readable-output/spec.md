## MODIFIED Requirements

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
