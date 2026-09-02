## ADDED Requirements

### Requirement: CLI read observation commands SHALL stay on in-repo Core ports without wrapping the public SDK

For the 1.12 CLI read-observation slice, Quantex SHALL observe agent state for
CLI `inspect`, `info`, `resolve`, and `list` through in-repo Core read ports.
Those commands MUST project the richer maintained v1 CLI human/JSON/NDJSON
contracts from Core observations and MUST NOT wrap public `createQuantex()`
`inspect()` or `list()` descriptors into a second CLI-shaped API. This CLI
ownership MUST NOT, by itself, expand the published `quantex-core` method
surface, change package/binary identity, bump state schema version 2, or alter
frozen command names, aliases, `--json` / `--output` fields, or exit-code
meanings.

#### Scenario: Default inspect, info, or resolve invocation

- **WHEN** a user invokes `inspect`, `info`, or `resolve` for a known agent
- **THEN** Quantex observes through in-repo Core read ports before projecting
  the maintained v1 CLI payload
- **AND THEN** the published SDK `inspect()` result type is not used as the
  CLI `--json` payload shape

#### Scenario: Machine-readable inspect, info, or resolve output

- **WHEN** `inspect`, `info`, or `resolve` runs with JSON or NDJSON output
- **THEN** the maintained v1 field names, types, and meanings remain unchanged
- **AND THEN** Core ownership of the observation path remains absent from the
  maintained output payloads

#### Scenario: Published SDK surface stays frozen for the read slice

- **WHEN** a TypeScript consumer inspects the published `quantex-core` root
  export after this CLI read-observation slice
- **THEN** `createQuantex()` still exposes only the previously published
  lifecycle methods
- **AND THEN** no new SDK method appears solely because CLI `inspect`,
  `info`, or `resolve` observe through in-repo Core
