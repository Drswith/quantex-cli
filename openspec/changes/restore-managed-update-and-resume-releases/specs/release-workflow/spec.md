## MODIFIED Requirements

### Requirement: Release-please SHALL run automatically on protected-branch push

On push to `main`, a `release-please` workflow SHALL run using `release-please-config.json`. It SHALL open or update the Release PR for the next version. `main` remains the only release channel.

A deferred-major readiness gate SHALL NOT be implemented by suppressing Release PR creation. Denial of an ineligible major belongs to the layers that name a version — generated Release PR validation, deterministic tag planning, and publication identity validation — so an ordinary eligible release on the current major is never blocked as a side effect.

#### Scenario: push to main opens a Release PR

- **WHEN** a commit is pushed to `main` that is not a release commit
- **THEN** the release-please workflow MUST run
- **AND** it MUST use `release-please-config.json`
- **AND** it MUST open or update a Release PR for the next version

#### Scenario: an ineligible major is proposed while a readiness gate is active

- **WHEN** conventional commits on `main` would compute a major version that a readiness gate denies
- **THEN** Release PR preparation MUST still run
- **AND** the generated Release PR MUST be rejected by Release PR validation rather than prevented from existing
- **AND** the deterministic tag-recovery job MUST remain available for an already merged eligible Release PR

#### Scenario: no second release branch is configured

- **WHEN** the release automation is inspected
- **THEN** no workflow trigger, branch allowlist, or release-please config file MAY designate a branch other than `main` as a release channel

## ADDED Requirements

### Requirement: Validation SHALL permit a boundary-only Release-As on a process-only PR

Release PR body validation SHALL permit a process-only pull request to declare a `Release-As` footer when the declared version's major is not greater than the current released major.

This exists because release-please computes a version from every conventional-commit marker in the range between the last release tag and `main`. A marker keeps forcing its bump until a release lands after it, even once the change it described has been undone. Clearing such a marker requires a pull request whose only release-worthy signal is a `Release-As` footer, and that pull request has no product change to carry. The allowance SHALL be limited to that footer: a release-worthy conventional-commit title or a `BREAKING CHANGE` footer on a process-only pull request MUST still be rejected. Validation MUST fail closed and reject the pull request when the current released major is not available to compare against.

The allowance SHALL NOT provide a route to a version that a readiness gate denies. A declared major above the current released major MUST be rejected by this requirement before any readiness gate is consulted, so a documentation or process pull request can never reach a deferred major.

#### Scenario: A process-only PR clears a stale marker

- **GIVEN** the range since the last release contains a marker that no longer describes a real change
- **AND** a pull request changes only process, documentation, or specification files
- **WHEN** it declares a `Release-As` footer naming a version at or below the current released major
- **THEN** Release PR body validation accepts it
- **AND** it MUST still supply a commit override under `## Release Summary` and repeat the same footer there

#### Scenario: A process-only PR names a higher major

- **WHEN** a process-only pull request declares a `Release-As` footer whose major exceeds the current released major
- **THEN** validation rejects it as release-worthy metadata on a process-only change
- **AND** the rejection does not depend on whether a readiness gate would also deny that version

#### Scenario: The allowance is not a general exemption

- **WHEN** a process-only pull request carries a release-worthy conventional-commit title or a `BREAKING CHANGE` footer
- **THEN** validation rejects it, whether or not a `Release-As` footer is present

#### Scenario: The current major cannot be determined

- **WHEN** validation cannot read the current released major
- **THEN** it MUST reject a process-only pull request carrying a `Release-As` footer rather than allow it

### Requirement: A Release-As footer MUST sit inside the commit override block

Release PR body validation SHALL require that a declared `Release-As` footer appears inside the `BEGIN_COMMIT_OVERRIDE` block rather than anywhere else in the `## Release Summary` section.

Release-please replaces the merged commit message with the contents of that block when the pull request is squash-merged. A footer placed after `END_COMMIT_OVERRIDE` is therefore never parsed, and the failure is silent: the release is prepared at the computed version with no error, no warning, and no log line naming the override. Validating placement is the only point at which the mistake is visible.

#### Scenario: The footer is placed outside the override block

- **GIVEN** a pull request body declares a `Release-As` footer
- **WHEN** that footer appears in the `## Release Summary` section but outside the `BEGIN_COMMIT_OVERRIDE` block
- **THEN** validation rejects the body
- **AND** the message states that release-please replaces the commit message with the block, so the footer would be ignored

#### Scenario: The footer is placed inside the override block

- **WHEN** the `Release-As` footer appears inside the `BEGIN_COMMIT_OVERRIDE` block
- **THEN** validation accepts it
- **AND** the block still requires a conventional-commit entry

### Requirement: Override markers MUST NOT appear outside the single override block

Commit messages SHALL NOT contain a commit-override marker, and a pull request body SHALL NOT contain more than one occurrence of each marker. Validation SHALL reject either case.

Release-please treats these markers as a message replacement and parses only the text between the first pair. A stray occurrence — most easily produced by prose that explains the mechanism and names the markers literally — silently changes which text is parsed. When the resulting text is not a conventional commit, release-please logs that the commit could not be parsed and drops it from the release entirely, discarding any `Release-As` footer it carried. Nothing else surfaces the mistake.

#### Scenario: A commit message names the markers

- **WHEN** a pull request commit message contains a commit-override marker
- **THEN** validation rejects it
- **AND** the message explains that release-please would parse only the text between the markers and drop the commit

#### Scenario: A pull request body names a marker twice

- **GIVEN** a pull request body carries one override block
- **WHEN** either marker also appears elsewhere in the body
- **THEN** validation rejects it

#### Scenario: A single override block is unaffected

- **WHEN** a pull request body contains exactly one override block and no other mention of the markers
- **THEN** validation accepts it

### Requirement: A declared Release-As MUST be verified against release-please's parser

Pull request validation SHALL run release-please's own commit parser over the pull request body whenever that body declares a `Release-As` footer, and SHALL fail when the parser would not apply the declared version.

Text-level checks cannot establish this. Release-please replaces the commit message with the text inside the override block and then parses it, so whether a declared version survives depends on that parser rather than on where a regex finds the footer. Three reviewed pull requests declared a version, satisfied every text-level check, merged, and produced no release before this verification existed.

#### Scenario: The declared version would not be applied

- **GIVEN** a pull request body declares a `Release-As` footer
- **WHEN** release-please's parser does not yield that version for the pull request
- **THEN** validation fails and names the reason, distinguishing a footer outside the override block from a pull request whose commit is dropped entirely

#### Scenario: The declared version would be applied

- **WHEN** the parser yields the declared version
- **THEN** validation passes

#### Scenario: No version is declared

- **WHEN** the body declares no `Release-As` footer
- **THEN** the verification is skipped rather than failed
