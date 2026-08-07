## ADDED Requirements

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
