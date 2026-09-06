## ADDED Requirements

### Requirement: Installed-version probes MUST target the resolved agent executable

When Quantex reports an installed version for a catalog agent, that version SHALL be parsed from a probe of the executable Quantex resolved for that agent. Quantex MUST NOT spawn a bare executable name from `PATH` when it already holds a resolved absolute path whose probe command leads with the agent's declared executable name.

When the catalog declares preferred binaries for version-probe targeting, Quantex SHALL locate the executable by trying those names in order before the agent's `binaryName`, completing PATH lookup and known-install-directory fallback for each name before moving to the next. The first existing executable wins. The installed-version field on `list` and `inspect` SHALL match that resolved executable.

#### Scenario: A preferred Cursor executable exists beside an unrelated PATH agent

- **GIVEN** Cursor CLI is catalogued with `binaryName` `agent` and preferred probe binary `cursor-agent`
- **AND** `PATH` contains an `agent` executable that is not Cursor CLI
- **AND** a `cursor-agent` executable exists on `PATH` or in a known install directory
- **WHEN** Quantex lists agents or inspects `cursor`
- **THEN** the reported installed version is the version of the resolved `cursor-agent` executable
- **AND** Quantex does not report the unrelated `agent` binary's version

#### Scenario: Preferred binary is absent

- **GIVEN** no preferred probe binary resolves
- **AND** the agent's `binaryName` resolves on `PATH` or in a known install directory
- **WHEN** Quantex probes the installed version
- **THEN** Quantex uses that `binaryName` resolution and probes through its absolute path
