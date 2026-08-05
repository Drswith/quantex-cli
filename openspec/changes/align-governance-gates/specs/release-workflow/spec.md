# release-workflow Delta

## ADDED Requirements

### Requirement: The shipped PR template MUST satisfy PR body governance

Because contributors and agents are required to write PR bodies based on `.github/pull_request_template.md`, that template SHALL itself pass the repository PR body governance check without modification. The template SHALL present every section required by PR body governance, and SHALL present its `Linked Artifacts` section so that an unmodified template already declares at least one meaningful artifact line, following the same option-list convention the template uses for release intent.

The agreement between the template and the governance check SHALL be enforced by automated regression coverage, so that editing either side without the other fails the test suite rather than surfacing later as a rejected pull request.

#### Scenario: Shipped template is validated directly

- **WHEN** the repository PR body governance command runs against `.github/pull_request_template.md`
- **THEN** it MUST report no policy issues

#### Scenario: Required sections drift apart

- **WHEN** a required PR body heading is added to or removed from PR body governance
- **AND** `.github/pull_request_template.md` is not updated to match
- **THEN** the repository test suite MUST fail

#### Scenario: Generated Release PR headers stay covered

- **WHEN** the release-please stable or beta `pull-request-header` template is validated by PR body governance
- **THEN** it MUST report no policy issues, so generated Release PRs pass the same gate as human pull requests
