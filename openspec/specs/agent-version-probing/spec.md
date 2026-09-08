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

Quantex MUST treat a non-zero version command exit as an unsuccessful probe and MUST NOT treat a version-like value from either output stream of that probe as installed-version evidence.

#### Scenario: A failed command writes a version-like stderr message

- **WHEN** an installed agent version command exits with a non-zero code and writes a version-like value to stderr
- **AND** no provider observation supplies an installed version
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

### Requirement: Installed-version display SHALL use the provider version when the PATH probe yields none

When a catalog agent's resolved PATH executable is present and the live version probe does not produce a version (non-zero exit, crash, or unparseable output), Quantex SHALL report the provider-reported version from the merged executable observation on `list`, `inspect`, `info`, `resolve`, and `doctor`. Quantex MUST still treat `installed` / `inPath` as PATH presence. Quantex MUST NOT fill `installedVersion` from a failed probe's stdout or stderr. Frozen `--json` field names, aliases, exit-code meanings, state schema version 2, and receipt shape MUST remain unchanged, and structured output MUST NOT expose engine or route identifiers.

#### Scenario: PATH present, version probe fails, provider reports version

- **GIVEN** the agent binary is present on PATH
- **AND** the agent's version command exits non-zero, crashes, or is unparseable
- **AND** the package provider observation reports present with a version
- **WHEN** a user runs `qtx ls`, `qtx inspect <agent>`, or `qtx doctor`
- **THEN** the displayed and structured `installedVersion` is the provider-reported version
- **AND** `inspect` includes the Version row
- **AND** JSON field names, types, and meanings are unchanged
- **AND** the payload does not include engine or route identifiers

#### Scenario: PATH absent stays not installed even when the provider reports a version

- **GIVEN** the PATH executable is absent
- **AND** the package provider observation reports present with a version
- **WHEN** a user runs `qtx ls` or `qtx inspect <agent>`
- **THEN** `installed` remains false
- **AND** `installedVersion` is omitted

