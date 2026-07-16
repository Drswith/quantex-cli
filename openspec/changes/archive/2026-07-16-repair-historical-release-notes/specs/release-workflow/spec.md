## ADDED Requirements

### Requirement: Post-redesign historical release notes MUST state the compatibility boundary

The maintained historical notes for `v0.29.1` and `v1.1.0` SHALL explain that the lifecycle-engine refactor was delivered after `v0.29.0`, and that the `v1.1.0` graduation does not intentionally remove the maintained v1 CLI, structured-output, state/config, binary-entry, or root-export contracts.

#### Scenario: User reads the repository changelog

- **WHEN** a user reads the `v0.29.1` or `v1.1.0` section of `CHANGELOG.md`
- **THEN** the section MUST provide a concise lifecycle-refactor and compatibility summary alongside the generated commit index

#### Scenario: User reads a published GitHub Release

- **WHEN** a user reads the published GitHub Release body for `v0.29.1` or `v1.1.0`
- **THEN** the body MUST provide the same compatibility interpretation as the corresponding changelog section

#### Scenario: Historical correction is delivered

- **WHEN** the historical-note correction is merged
- **THEN** it MUST NOT move a release tag, publish an npm package, or change release automation behavior
