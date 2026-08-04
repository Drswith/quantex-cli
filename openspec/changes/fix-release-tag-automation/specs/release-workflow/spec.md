## MODIFIED Requirements

### Requirement: Tag push SHALL trigger publish without redundant merge gates

When a `v*` tag is pushed (created by release-please on Release PR merge or by the release tag backstop when release-please leaves a merged Release PR untagged), `release.yml` SHALL build, verify release artifacts, smoke-test, and publish to npm and GitHub Release without re-running lint, typecheck, or vitest gates already enforced at merge.

#### Scenario: tag publish runs artifact pipeline only

- **WHEN** a `v<version>` tag is pushed
- **THEN** `release.yml` MUST run build, `release:artifacts`, `release:smoke`, and npm/GitHub publish
- **AND** it MUST NOT require lint, format:check, typecheck, or test jobs to pass again

### Requirement: Release tag backstop SHALL seal manually merged Release PRs

After each push to `main` or `beta`, a release tag backstop SHALL create `v<version>` when the branch head is a `chore: release <version>` commit, the manifest version has no tag at that commit, and the branch-head push CI run succeeded. The backstop MUST relabel the merged release PR from `autorelease: pending` to `autorelease: tagged` so subsequent release-please runs are not blocked.

#### Scenario: manually merged Release PR receives tag after CI

- **WHEN** a release-please Release PR is merged manually to `main` or `beta`
- **AND** the branch head commit title is `chore: release <version>`
- **AND** push CI succeeded on that commit
- **AND** tag `v<version>` does not exist at the branch head
- **THEN** the backstop MUST push tag `v<version>` at the branch head
- **AND** it MUST relabel the merged release PR to `autorelease: tagged`

#### Scenario: backstop is a no-op when tag already exists

- **WHEN** tag `v<version>` already points at the branch head release commit
- **THEN** the backstop MUST NOT create a duplicate tag
- **AND** it MAY relabel a stale `autorelease: pending` release PR to unblock release-please
