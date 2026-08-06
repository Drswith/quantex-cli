# release-workflow Delta

## MODIFIED Requirements

### Requirement: Release-please SHALL run automatically on protected-branch push

On push to `main`, a `release-please` workflow SHALL open or update the Release PR using `release-please-config.json`. `main` is the only release channel: there is no second protected branch holding an independent version, because both channels would key the same package path against the same manifest file and could not diverge without a merge that overwrites the version state recording the divergence.

#### Scenario: push to main opens a Release PR

- **WHEN** a commit is pushed to `main` that is not a release commit
- **THEN** the release-please workflow MUST run
- **AND** it MUST use `release-please-config.json`
- **AND** it MUST open or update a Release PR for the next version

#### Scenario: no second release branch is configured

- **WHEN** the release automation is inspected
- **THEN** no workflow trigger, branch allowlist, or release-please config file MAY designate a branch other than `main` as a release channel

### Requirement: Protected branches SHALL require aligned status check contexts

The `main` protected branch SHALL require status check contexts that match the consolidated CI workflow job names and actually run on pull requests: `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, and `test (macos-latest)`. The `classify` job SHALL NOT be a required context. The `sandbox-tests` workflow SHALL remain advisory and SHALL NOT be a required context.

#### Scenario: main branch protection matches CI job names

- **WHEN** a maintainer inspects branch protection for `main`
- **THEN** the required contexts MUST be exactly the five consolidated CI job names
- **AND** `classify` and `sandbox-tests` MUST NOT appear among them

## ADDED Requirements

### Requirement: Prereleases SHALL be cut from main and preview the next unreleased version

A prerelease SHALL be produced from `main` by declaring `Release-As: <version>` with a prerelease suffix on a source PR, and SHALL name the next unreleased version rather than a version that has already shipped. The release identity contract SHALL resolve the target branch to `main` for every release regardless of version shape, and SHALL continue to derive the npm dist-tag from the version so that a prerelease publishes to `beta` and a stable release publishes to `latest`.

Because a prerelease previews an unreleased version, the published `beta` dist-tag SHALL always resolve above `latest` by SemVer precedence. Cutting a prerelease of an already-published version is prohibited: such a version sorts below the release it names.

#### Scenario: prerelease is cut from main

- **WHEN** a source PR declares `Release-As: 1.9.0-beta.1` and merges to `main`
- **THEN** release tagging MUST resolve the target branch to `main`
- **AND** publication MUST use the `beta` npm dist-tag
- **AND** the resulting version MUST sort above the current `latest`

#### Scenario: stable release is unaffected

- **WHEN** a release commit for a version without a prerelease suffix merges to `main`
- **THEN** release tagging MUST resolve the target branch to `main`
- **AND** publication MUST use the `latest` npm dist-tag

#### Scenario: Release PR title carries a prerelease version

- **WHEN** release-please opens a Release PR on `main` for a prerelease version
- **THEN** release PR governance MUST accept the prerelease title shape

## REMOVED Requirements

### Requirement: Beta branch protection SHALL mirror main

**Reason**: `beta` is no longer a release channel, so there is no second protected branch whose protection must match.

**Migration**: Prereleases are cut from `main` under the prerelease-from-main requirement above. The frozen `v1.8.2-beta` tag and the npm `beta` dist-tag pointing at it are registry state, not repository state; repointing or removing that dist-tag is a separate maintainer action.
