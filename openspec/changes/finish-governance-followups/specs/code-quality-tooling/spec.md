# code-quality-tooling Delta

## ADDED Requirements

### Requirement: Merge-gating and advisory workflows SHALL cancel superseded runs

`ci.yml` and `sandbox-tests.yml` SHALL each declare a concurrency group that cancels superseded **pull request** runs. `ci.yml` triggers on the `edited` pull request activity type so that PR body governance re-validates an edited description; without a concurrency group, a burst of edits leaves several full three-platform matrices running against superseded content.

Push runs SHALL NOT be cancelled. Release tagging only tags a release commit whose exact SHA has a successful `ci.yml` run, so a push run cancelled by a later merge leaves that SHA permanently without a successful run — and if the cancelled push was a Release PR merge, the release silently never happens. Keying push runs by commit rather than by ref keeps them from colliding at all.

Release workflows are excluded from this requirement: they already declare non-cancelling groups, because cancelling a publication mid-flight is not safe.

#### Scenario: Pull request is edited repeatedly

- **WHEN** a contributor edits a pull request title or body while a CI run is in progress
- **THEN** the superseded run MUST be cancelled
- **AND** only the newest run MUST remain

#### Scenario: Two merges land back to back

- **WHEN** a push to `main` starts a CI run and a second merge lands before it finishes
- **THEN** the first run MUST NOT be cancelled
- **AND** both commits MUST end with their own CI conclusion, so release tagging can find a successful run at either SHA

#### Scenario: Release runs are not cancelled

- **WHEN** a release workflow is running
- **THEN** its concurrency group MUST NOT cancel in-progress runs

## MODIFIED Requirements

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

Modal-backed isolation coverage SHALL run on a schedule and on manual dispatch, and SHALL NOT run on pull requests. It SHALL remain advisory and SHALL NOT be a required status check.

Per-pull-request execution was removed because the workflow never gated anything: it is advisory by design, fork pull requests skip it for lack of secrets, and its observed failures were external Modal capacity rather than repository regressions. Running it on every pull request paid a full run for a signal nothing consumed.

#### Scenario: Pull request does not trigger sandbox tests

- **WHEN** a pull request is opened or updated
- **THEN** the Modal-backed isolation workflow MUST NOT run

#### Scenario: Scheduled and dispatched runs still provide coverage

- **WHEN** the schedule fires, or a maintainer dispatches the workflow manually
- **THEN** the Modal-backed isolation coverage MUST run
- **AND** its result MUST remain advisory
