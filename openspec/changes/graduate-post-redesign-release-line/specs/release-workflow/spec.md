## MODIFIED Requirements

### Requirement: Stable release planning MUST keep pre-major breaking changes on the zero-major line

The stable Release workflow SHALL treat `0.29.1` as the final publishable 0.x version and SHALL permit graduation from a stable 0.x base only for the exact transition `0.29.1 -> 1.1.0`. It MUST reject later 0.x proposals while `0.29.1` is the current base, MUST reject every other pre-major-to-major transition, and SHALL resume ordinary SemVer planning after `1.1.0` is published.

#### Scenario: Release planning proposes another 0.x version after the final baseline

- **GIVEN** the current stable version is `0.29.1`
- **WHEN** release automation proposes `0.29.2`, `0.30.0`, or any other stable 0.x version
- **THEN** Release PR validation MUST reject the proposal
- **AND** `0.29.1` MUST remain the final 0.x release

#### Scenario: Exact post-redesign graduation is requested

- **GIVEN** the current stable version is `0.29.1`
- **AND** the accepted main commit carries the one-shot footer `Release-As: 1.1.0`
- **WHEN** release-please prepares the stable Release PR
- **THEN** it MUST propose exactly `1.1.0`
- **AND** the generated Release PR MUST remain subject to normal protected-branch validation and manual rebase-first merge
- **AND** the Release PR workflow MUST skip bot-token creation and auto-merge enablement for that exact graduation PR

#### Scenario: A different pre-major graduation is proposed

- **GIVEN** the current stable version is below `1.0.0`
- **WHEN** a stable Release PR proposes `1.0.0`, proposes a 1.x version other than `1.1.0`, or proposes `1.1.0` from a base other than `0.29.1`
- **THEN** Release PR validation MUST reject the proposal
- **AND** burned version `1.0.0` MUST remain unpublished

#### Scenario: Stable releases continue after graduation

- **GIVEN** `1.1.0` or a newer stable 1.x version is the current base
- **WHEN** release-worthy changes reach `main`
- **THEN** release-please SHALL apply ordinary SemVer planning
- **AND** the one-shot `Release-As: 1.1.0` override MUST NOT remain in workflow or manifest configuration
