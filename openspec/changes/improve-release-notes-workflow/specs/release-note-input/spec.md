## ADDED Requirements

### Requirement: Release-source PRs MUST provide release-please consumable summaries

Every non-generated pull request with release-worthy metadata SHALL include a `## Release Summary` section containing a non-empty `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` block. The override MUST contain at least one conventional-commit entry with a meaningful description suitable for user-facing release notes.

#### Scenario: Feature PR provides a summary

- **WHEN** a product-impacting PR uses release-worthy feature, fix, performance, refactor-breaking, or breaking-change metadata
- **THEN** local and remote PR governance MUST accept it only when its Release Summary contains a valid non-empty commit override

#### Scenario: Release source omits the summary

- **WHEN** a non-generated PR uses release-worthy metadata
- **AND** its Release Summary is missing, blank, malformed, or contains only a placeholder override
- **THEN** PR governance MUST reject the PR before merge with guidance to provide a release-please commit override

#### Scenario: Generated Release PR is validated separately

- **WHEN** a release-please generated version PR is validated
- **THEN** it MUST remain subject to dedicated Release PR policy
- **AND** it MUST NOT be rejected for omitting a source-PR Release Summary

### Requirement: Release-As source metadata MUST be explicit

A source PR that requests a one-shot release through `Release-As` SHALL declare the same non-empty `Release-As: <version>` footer in its Release Summary and in the merged commit.

#### Scenario: Neutral release trigger is documented

- **WHEN** a source PR uses `Release-As` without feature or breaking conventional metadata
- **THEN** PR governance MUST treat the declared footer as release-worthy metadata
- **AND** it MUST require both the release summary override and the visible Release-As declaration
