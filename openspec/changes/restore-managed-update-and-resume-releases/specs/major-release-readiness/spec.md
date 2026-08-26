## MODIFIED Requirements

### Requirement: Stable v2 SHALL remain deferred until explicit readiness evidence exists

The repository SHALL treat every stable `2.x` version as ineligible until a future reviewed OpenSpec change records the completed required v2 refactor and evidence that at least 90 days have elapsed since that refactor merged. A generic major-version declaration SHALL NOT satisfy this temporary readiness requirement.

The gate SHALL deny stable `2.x` at every boundary that names a version, and SHALL NOT deny it by preventing Release PR preparation from running. Suppressing preparation also blocks eligible releases on the current major, which is a broader effect than the readiness requirement calls for.

#### Scenario: main receives another push while v2 is deferred

- **WHEN** Release Please runs for a push to `main`
- **AND** the stable v2 readiness gate remains active
- **THEN** it MUST prepare a Release PR for whatever version conventional commits compute
- **AND** deterministic tag recovery MUST remain available for an already merged eligible 1.x Release PR

#### Scenario: a stable v2 Release PR is created outside the normal preparation path

- **WHEN** a generated Release PR proposes a stable `2.x` version
- **THEN** Release PR validation MUST fail with the deferred-readiness reason
- **AND** adding `Release-As: <2.x version>` to the PR body MUST NOT make it eligible

#### Scenario: stable v2 reaches deterministic tag planning

- **WHEN** tag planning resolves an otherwise valid stable `2.x` release commit
- **THEN** tag planning MUST fail before creating or moving a version tag

#### Scenario: a stable v2 tag is pushed manually

- **WHEN** publication identity validation receives a stable `2.x` package version and matching tag
- **THEN** validation MUST fail before release-candidate build or publication

#### Scenario: future owner proposes lifting the gate

- **WHEN** the required v2 refactor is incomplete or fewer than 90 days have elapsed since it merged
- **THEN** the temporary gate MUST remain active
- **AND** no date-only or body-only override MAY unlock stable v2

#### Scenario: the refactor has stabilized

- **WHEN** a future reviewed OpenSpec change identifies the completed refactor and records evidence of at least 90 elapsed days
- **THEN** that change MAY remove or replace the preparation, Release PR, tag, and publication gates together
