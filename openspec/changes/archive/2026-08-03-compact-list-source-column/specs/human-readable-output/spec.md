## MODIFIED Requirements

### Requirement: Default inventory output prioritizes lifecycle summary

The default human-readable `list` output SHALL explicitly show each agent's installation state. When terminal width permits, it SHALL show aligned agent, installed-state, version, compact installation-source, and update-mode columns. The source column SHALL use a short, truthful token for recorded managed and unmanaged installation methods or for a PATH-only discovery, while verbose provider and package source evidence remains available through `qtx inspect <agent>`.

#### Scenario: List agents at a typical terminal width

- **WHEN** a user runs `qtx list` or `qtx ls` in human mode at a terminal width that fits all declared list columns
- **THEN** Quantex displays aligned agent, installed-state, version, source, and update-mode columns
- **AND** displays a concise installed/not-installed summary

#### Scenario: List compact installation source

- **WHEN** a displayed agent has a recorded managed `bun` or `npm` installation, an unmanaged script or binary record, or is only discovered on PATH
- **THEN** the source cell displays the corresponding compact token without a package name
- **AND** a PATH-only discovery is displayed as `PATH` rather than attributed to a package manager

#### Scenario: Source evidence yields to a narrow terminal

- **WHEN** optional list columns do not fit within the available terminal width
- **THEN** Quantex removes optional columns according to the responsive table priority before wrapping rows
- **AND** preserves agent identity and installation state

#### Scenario: Inspect detailed installation evidence

- **WHEN** a user needs provider, package, path, or other detailed source evidence
- **THEN** Quantex continues to direct the user to `qtx inspect <agent>`
