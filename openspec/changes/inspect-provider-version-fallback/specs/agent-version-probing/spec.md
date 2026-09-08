## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Version probe failures do not become installed-version evidence

Quantex MUST treat a non-zero version command exit as an unsuccessful probe and MUST NOT treat a version-like value from either output stream of that probe as installed-version evidence.

#### Scenario: A failed command writes a version-like stderr message

- **WHEN** an installed agent version command exits with a non-zero code and writes a version-like value to stderr
- **AND** no provider observation supplies an installed version
- **THEN** Quantex reports no installed version
