# agent-version-probing Specification

## Purpose
TBD - created by archiving change fix-stderr-version-probe. Update Purpose after archive.
## Requirements
### Requirement: Successful installed-version probes parse stdout before stderr

Quantex SHALL parse a successful installed-agent version probe from stdout first. When stdout does not produce a version, Quantex SHALL independently parse stderr as the fallback stream.

#### Scenario: Version is emitted only on stderr

- **WHEN** an installed agent version command exits with code 0, emits no parseable value on stdout, and emits a version on stderr
- **THEN** Quantex reports the version parsed from stderr

#### Scenario: Version is emitted on stdout and stderr

- **WHEN** an installed agent version command exits with code 0 and both stdout and stderr contain parseable values
- **THEN** Quantex reports the version parsed from stdout

#### Scenario: A custom parser needs stderr fallback

- **WHEN** a configured version parser returns no version for stdout and returns a version for stderr
- **THEN** Quantex invokes the parser independently for stderr and reports the stderr result

### Requirement: Version probe failures do not become installed-version evidence

Quantex MUST treat a non-zero version command exit as an unsuccessful probe and MUST NOT report a version from either output stream.

#### Scenario: A failed command writes a version-like stderr message

- **WHEN** an installed agent version command exits with a non-zero code and writes a version-like value to stderr
- **THEN** Quantex reports no installed version

### Requirement: Version probe stream fallback preserves existing parser boundaries

Quantex MUST pass stdout and stderr to the existing version parser independently and MUST NOT concatenate the streams before parsing.

#### Scenario: Stderr contains diagnostics alongside a valid version

- **WHEN** stdout does not produce a version and stderr contains the version output plus unrelated diagnostic lines
- **THEN** Quantex applies the existing first-line/parser semantics to stderr alone
- **AND** it does not prepend or append stdout content to the parser input

### Requirement: Installed-version probes MUST target the resolved agent executable

When Quantex reports an installed version for a catalog agent, that version SHALL be parsed from a probe of the executable Quantex resolved for that agent. Quantex MUST NOT spawn a bare executable name from `PATH` when it already holds a resolved absolute path whose probe command leads with the agent's declared executable name.

For Cursor CLI, Quantex SHALL locate the executable by trying `cursor-agent` before `binaryName` `agent`, completing PATH lookup and known-install-directory fallback for each name before moving to the next. The first existing executable wins. Other catalog agents SHALL keep single-name lookup of `binaryName`. The installed-version field on `list` and `inspect` SHALL match that resolved executable.

#### Scenario: A preferred Cursor executable exists beside an unrelated PATH agent

- **GIVEN** Cursor CLI is catalogued with `binaryName` `agent`
- **AND** `PATH` contains an `agent` executable that is not Cursor CLI
- **AND** a `cursor-agent` executable exists on `PATH` or in a known install directory
- **WHEN** Quantex lists agents or inspects `cursor`
- **THEN** the reported installed version is the version of the resolved `cursor-agent` executable
- **AND** Quantex does not report the unrelated `agent` binary's version

#### Scenario: Preferred binary is absent

- **GIVEN** no `cursor-agent` executable resolves
- **AND** the agent's `binaryName` resolves on `PATH` or in a known install directory
- **WHEN** Quantex probes the installed version
- **THEN** Quantex uses that `binaryName` resolution and probes through its absolute path

