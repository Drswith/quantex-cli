## MODIFIED Requirements

### Requirement: Release tagging SHALL seal merged Release PRs deterministically

Because release-please runs with `skip-github-release: true` and maintainers re-author Release PR branches before merge, a dedicated `tag-release` job SHALL run before release-please on each protected-branch push. When the branch head is a `chore: release <version>` commit, the manifest version has no tag at that commit, and the branch-head push CI run succeeded, the job SHALL create and push `v<version>` with `git push` under the release GitHub App token, SHALL then dispatch `release.yml` at that tag without polling for a tag-event run, and SHALL relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`.

The job SHALL additionally publish the branch's seal state as a job output: whether the tag for the version recorded in the protected branch's current `.release-please-manifest.json` exists. That state SHALL be resolved from the branch tip rather than from the pushed commit, because a run queued behind another push evaluates a checkout that predates the release commit while release-please reads the branch live.

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

#### Scenario: seal state is read from the branch tip

- **WHEN** the tag-release job resolves the branch seal state
- **THEN** it MUST read the manifest version from the protected branch tip rather than from the pushed commit
- **AND** it MUST report the branch as sealed only when the tag for that version exists
- **AND** it MUST report the branch as unsealed when its own plan tagged a different, older version

## ADDED Requirements

### Requirement: Release-please preparation SHALL run only on a sealed branch

Release PR preparation SHALL NOT run unless the tag for the version recorded in the protected branch's current `.release-please-manifest.json` already exists. The `release-please` job SHALL depend on `tag-release` and SHALL be gated on its published seal state, so an unsealed branch, a failed sealing job, or a sealing job that timed out waiting for push CI all skip preparation rather than proceeding.

The precondition exists because release-please derives its commit range from that tag. It matches the manifest version against GitHub Releases, falls back to matching it against git tags, and when neither resolves it keeps the manifest version as the changelog comparison point but leaves the range boundary undefined. An undefined boundary is not treated as an error: the range becomes the entire history up to the commit search depth, which re-admits every conventional-commit marker the project has ever merged, including one-shot `Release-As` footers that a past release already settled. A settled `Release-As` is a hard version assignment, so the computed version can move *backwards* past the version that is already published.

Skipping preparation is safe because it is not the last opportunity. The push that merges a Release PR seals it, and any commit that landed beside it is prepared by the next push to the protected branch, evaluated against a boundary that now resolves.

#### Scenario: the release commit's own push seals before it prepares

- **WHEN** a `chore: release <version>` commit is pushed to `main`
- **THEN** the tag-release job MUST run first and push `v<version>`
- **AND** release-please MUST run afterwards with that tag resolvable as its range boundary

#### Scenario: a run queued behind the release commit does not prepare

- **GIVEN** an ordinary commit and a release commit are pushed to `main` in close succession
- **AND** the run for the ordinary commit checks out a commit that predates the release commit
- **WHEN** that run resolves the branch seal state from the tip and finds the manifest version untagged
- **THEN** release-please MUST NOT run in that run
- **AND** preparation MUST be left to the run for the release commit

#### Scenario: sealing failure blocks preparation

- **WHEN** the tag-release job fails, is skipped, or times out waiting for protected-branch push CI
- **THEN** release-please MUST NOT run
- **AND** the next protected-branch push MUST retry sealing before preparation

#### Scenario: an ordinary push on a sealed branch prepares normally

- **WHEN** a commit that is not a release commit is pushed to `main`
- **AND** the tag for the current manifest version exists
- **THEN** release-please MUST run and open or update the Release PR for the next version
