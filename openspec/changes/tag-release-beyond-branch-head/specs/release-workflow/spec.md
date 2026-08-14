## MODIFIED Requirements

### Requirement: Release tagging SHALL seal merged Release PRs deterministically

Because release-please runs with `skip-github-release: true` and maintainers re-author Release PR branches before merge, a dedicated `tag-release` job SHALL run after release-please on each protected-branch push. The job SHALL locate the release commit for the manifest version by searching a bounded window of recent first-parent branch history for the commit whose title is exactly `chore: release <version>`, and SHALL NOT require that commit to be the branch head. When such a commit exists, the manifest version has no tag at that commit, and that commit's push CI run succeeded, the job SHALL create and push `v<version>` at that commit with `git push` under the release GitHub App token, SHALL then dispatch `release.yml` at that tag without polling for a tag-event run, and SHALL relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`.

`package.json` remains the sole authority for which version is being released. When no commit in the search window matches the manifest version, the job SHALL be a no-op rather than tagging an unrelated commit.

The job SHALL resolve the release commit and check for an existing tag before waiting on CI, so a push that has nothing to tag settles without consuming the CI wait.

The tag event does not start publication for the release bot, so waiting on it is dead time rather than a safeguard. `actions/checkout` persists the default `GITHUB_TOKEN` as an `http.https://github.com/.extraheader` credential; git sends that header on the first request, the App token embedded in the push URL is only consulted after a `401` that never arrives, and GitHub attributes the push to `GITHUB_TOKEN`, whose events do not start workflow runs. Every `release.yml` run since automation took over tagging has been a `workflow_dispatch` run, so the previous grace period expired in full on every release.

`release.yml` SHALL keep its `on: push: tags` trigger for maintainer-pushed tags. A duplicate run for one tag is already safe: the release concurrency group is keyed on the tag and does not cancel in flight, and the pipeline treats an exact already-published npm version as published.

#### Scenario: manually merged Release PR receives tag after CI

- **WHEN** a release-please Release PR is merged manually to `main`
- **AND** the branch head commit title is `chore: release <version>`
- **AND** push CI succeeded on that commit
- **AND** tag `v<version>` does not exist at that commit
- **THEN** the tag-release job MUST push tag `v<version>` at that commit through `git push`
- **AND** it MUST relabel the merged release PR to `autorelease: tagged`

#### Scenario: later commits do not strand the release

- **WHEN** one or more non-release commits are pushed to `main` after the release commit and before the tag-release job evaluates
- **AND** the release commit for the manifest version is still within the search window
- **AND** push CI succeeded on the release commit
- **THEN** the tag-release job MUST push tag `v<version>` at the release commit, not at the branch head
- **AND** it MUST NOT report the push as a no-op because the branch head is not a release commit

#### Scenario: a stranded release recovers on the next push

- **WHEN** a release commit's manifest version has no tag and the branch head has moved past that commit
- **AND** any later push to `main` runs the tag-release job
- **THEN** the job MUST tag the release commit without maintainer action
- **AND** it MUST NOT require a hand-pushed tag to publish that version

#### Scenario: manifest version has no release commit in the window

- **WHEN** no commit in the search window has the title `chore: release <version>` for the manifest version
- **THEN** the tag-release job MUST be a no-op
- **AND** it MUST NOT tag any other commit with that version

#### Scenario: workflow dispatch is the release trigger

- **WHEN** the tag-release job pushes tag `v<version>`
- **THEN** it MUST dispatch `release.yml` at that tag immediately after the push
- **AND** it MUST NOT poll for a tag-event Release workflow run before dispatching
- **AND** it MUST NOT expose a dispatch grace period knob

#### Scenario: maintainer-pushed tags still publish

- **WHEN** a maintainer pushes a `v<version>` tag directly
- **THEN** `release.yml` MUST still run from its `on: push: tags` trigger

#### Scenario: tag-release is a no-op when tag already exists

- **WHEN** tag `v<version>` already points at the resolved release commit
- **THEN** the tag-release job MUST NOT create a duplicate tag
- **AND** it MUST settle without waiting for CI
- **AND** it MAY relabel a stale `autorelease: pending` release PR to unblock release-please

#### Scenario: tag at a different commit fails closed

- **WHEN** tag `v<version>` exists at a commit other than the resolved release commit
- **THEN** the tag-release job MUST fail
- **AND** it MUST NOT move or replace the existing tag
