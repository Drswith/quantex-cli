## ADDED Requirements

### Requirement: Cursor CLI catalog identity MUST stay `agent` while version probing prefers `cursor-agent`

Quantex SHALL keep Cursor CLI in the supported agent catalog with canonical name `cursor`, executable `binaryName` `agent`, and lookup alias `agent`. Lookup aliases MUST NOT include the canonical name `cursor`. The catalog SHALL declare `cursor-agent` as a preferred version-probe binary so observation can locate Cursor CLI without renaming the catalog identity.

Structured `list` and `inspect` output SHALL continue to report `binaryName` as `agent`. Preferred probe binaries are catalog targeting metadata and MUST NOT appear as a new CLI `--json` field.

#### Scenario: Looking up Cursor CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `cursor` or the alias `agent`
- **THEN** Quantex returns the Cursor CLI catalog entry
- **AND** the entry identifies `agent` as the executable `binaryName`
- **AND** the entry's lookup aliases are `agent` and do not include `cursor`

#### Scenario: Probing Cursor CLI version

- **WHEN** Quantex probes the installed version of Cursor CLI
- **THEN** it locates `cursor-agent` before falling back to `agent`
- **AND** it runs the catalog version-probe command against the resolved absolute path
- **AND** structured output still reports `binaryName` as `agent`
