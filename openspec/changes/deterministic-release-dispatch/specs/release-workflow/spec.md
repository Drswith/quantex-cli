# release-workflow Delta

## MODIFIED Requirements

### Requirement: Release tagging SHALL seal merged Release PRs deterministically

Because release-please runs with `skip-github-release: true` and maintainers re-author Release PR branches before merge, a dedicated `tag-release` job SHALL run after release-please on each protected-branch push. When the branch head is a `chore: release <version>` commit, the manifest version has no tag at that commit, and the branch-head push CI run succeeded, the job SHALL create and push `v<version>` with `git push` under the release GitHub App token, SHALL then dispatch `release.yml` at that tag without polling for a tag-event run, and SHALL relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`.

The tag event does not start publication for the release bot, so waiting on it is dead time rather than a safeguard. `actions/checkout` persists the default `GITHUB_TOKEN` as an `http.https://github.com/.extraheader` credential; git sends that header on the first request, the App token embedded in the push URL is only consulted after a `401` that never arrives, and GitHub attributes the push to `GITHUB_TOKEN`, whose events do not start workflow runs. Every `release.yml` run since automation took over tagging has been a `workflow_dispatch` run, so the previous grace period expired in full on every release.

`release.yml` SHALL keep its `on: push: tags` trigger for maintainer-pushed tags. A duplicate run for one tag is already safe: the release concurrency group is keyed on the tag and does not cancel in flight, and the pipeline treats an exact already-published npm version as published.

#### Scenario: manually merged Release PR receives tag after CI

- **WHEN** a release-please Release PR is merged manually to `main`
- **AND** the branch head commit title is `chore: release <version>`
- **AND** push CI succeeded on that commit
- **AND** tag `v<version>` does not exist at the branch head
- **THEN** the tag-release job MUST push tag `v<version>` at the branch head through `git push`
- **AND** it MUST relabel the merged release PR to `autorelease: tagged`

#### Scenario: workflow dispatch is the release trigger

- **WHEN** the tag-release job pushes tag `v<version>`
- **THEN** it MUST dispatch `release.yml` at that tag immediately after the push
- **AND** it MUST NOT poll for a tag-event Release workflow run before dispatching
- **AND** it MUST NOT expose a dispatch grace period knob

#### Scenario: maintainer-pushed tags still publish

- **WHEN** a maintainer pushes a `v<version>` tag directly
- **THEN** `release.yml` MUST still run from its `on: push: tags` trigger

#### Scenario: tag-release is a no-op when tag already exists

- **WHEN** tag `v<version>` already points at the branch head release commit
- **THEN** the tag-release job MUST NOT create a duplicate tag
- **AND** it MAY relabel a stale `autorelease: pending` release PR to unblock release-please
