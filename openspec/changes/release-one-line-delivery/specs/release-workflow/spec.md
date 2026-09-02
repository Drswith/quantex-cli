## MODIFIED Requirements

### Requirement: Release tagging SHALL seal merged Release PRs deterministically

Because release-please runs with `skip-github-release: true` and maintainers re-author Release PR branches before merge, a dedicated `tag-release` job SHALL run before release-please on each protected-branch push. When the branch head is a `chore: release <version>` commit, the manifest version has no tag at that commit, and the branch-head push CI run succeeded, the job SHALL create and push `v<version>` with `git push` under the release GitHub App token, SHALL then dispatch `release.yml` at that tag without polling for a tag-event run, and SHALL relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`.

The job SHALL additionally publish the branch's seal state as a job output. A branch is sealed only when both of the following hold for the version recorded in the protected branch's current `.release-please-manifest.json`:

1. the tag `v<version>` exists; and
2. a `Release` workflow run for that tag has completed with success.

That state SHALL be resolved from the branch tip rather than from the pushed commit, because a run queued behind another push evaluates a checkout that predates the release commit while release-please reads the branch live. A tag without a successful Release workflow SHALL leave the branch unsealed so preparation cannot race ahead of publication.

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
- **AND** it MUST report the branch as sealed only when the tag for that version exists and a Release workflow run for that tag has succeeded
- **AND** it MUST report the branch as unsealed when the tag is missing
- **AND** it MUST report the branch as unsealed when the tag exists but no successful Release workflow run for that tag is evident
- **AND** it MUST report the branch as unsealed when its own plan tagged a different, older version

### Requirement: Published releases MUST exercise the documented standalone installers

Before the release workflow publishes the CLI package to npm, it SHALL run a non-cancelling matrix against the exact release-candidate artifact built for that tag. The matrix MUST run the versioned `install.sh` on at least one hosted Linux runner and one hosted macOS runner, and MUST run the versioned `install.ps1` on a hosted Windows runner. Each leg SHALL install from the candidate asset bytes (not from the public npm registry and not from an already-public GitHub Release download), install into an isolated scratch directory, and verify that the installed primary executable and documented alias run successfully and report the expected release version. The npm publish step SHALL depend on that matrix succeeding.

The installers MAY accept an explicit download-base override for this candidate smoke path. Default end-user installs that omit the override MUST keep using the public GitHub Release download URLs.

#### Scenario: Candidate installer smoke gates npm publish

- **WHEN** `release.yml` has built and uploaded the release-candidate artifact for `v<version>`
- **THEN** it MUST run the release-tagged `install.sh` on Linux and macOS against that candidate
- **AND** it MUST run the release-tagged `install.ps1` on Windows against that candidate
- **AND** the npm publish step MUST NOT run until every installer matrix leg has succeeded

#### Scenario: POSIX installer smoke succeeds against the candidate

- **GIVEN** the release-candidate artifact contains the platform archive and `SHA256SUMS.txt`
- **WHEN** a Linux or macOS matrix leg runs `install.sh` against that candidate in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex` and `qtx` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: Windows installer smoke succeeds against the candidate

- **GIVEN** the release-candidate artifact contains `quantex-windows-x64.exe.zip` and `SHA256SUMS.txt`
- **WHEN** the Windows matrix leg runs `install.ps1` against that candidate in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex.exe` and `qtx.exe` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: An installer cannot consume the candidate

- **WHEN** any installer matrix leg cannot download, verify, extract, or execute the exact candidate assets
- **THEN** that leg MUST fail the release workflow
- **AND** its failure MUST identify the installer and hosted runner that failed
- **AND** the other matrix legs MUST still be allowed to report their own result
- **AND** npm publish MUST NOT run for that workflow attempt

#### Scenario: Candidate installer verification fails before npm publish

- **WHEN** the installer matrix fails before npm publish
- **THEN** the release workflow MUST remain failed
- **AND** it MUST NOT publish the CLI package to npm in that run
- **AND** maintainers MUST be able to rerun the same tag after remediation without moving the tag

### Requirement: Release-please preparation SHALL run only on a sealed branch

Release PR preparation SHALL NOT run unless the branch is sealed: the tag for the version recorded in the protected branch's current `.release-please-manifest.json` exists, and a `Release` workflow run for that tag has succeeded. The `release-please` job SHALL depend on `tag-release` and SHALL be gated on its published seal state, so an unsealed branch, a failed sealing job, a sealing job that timed out waiting for push CI, or a tag whose Release workflow has not succeeded all skip preparation rather than proceeding.

The `Release Please` workflow SHALL also run when a `Release` workflow completes, so preparation can resume once the current version's Release workflow succeeds without waiting for an unrelated later push. A failed `Release` completion MUST NOT prepare the next Release PR.

The precondition exists because release-please derives its commit range from that tag. It matches the manifest version against GitHub Releases, falls back to matching it against git tags, and when neither resolves it keeps the manifest version as the changelog comparison point but leaves the range boundary undefined. An undefined boundary is not treated as an error: the range becomes the entire history up to the commit search depth, which re-admits every conventional-commit marker the project has ever merged, including one-shot `Release-As` footers that a past release already settled. A settled `Release-As` is a hard version assignment, so the computed version can move *backwards* past the version that is already published. Preparing the next version before the current tag's Release workflow has succeeded recreates that class of race even when the tag itself exists.

Skipping preparation is safe because it is not the last opportunity. The push that merges a Release PR tags it, the Release workflow publishes it, and preparation resumes from the next sealed evaluation — either the `Release` completion trigger or a later protected-branch push — against a boundary that now resolves.

#### Scenario: the release commit's own push tags before it prepares

- **WHEN** a `chore: release <version>` commit is pushed to `main`
- **THEN** the tag-release job MUST run first and push `v<version>`
- **AND** release-please MUST NOT treat the branch as sealed until a Release workflow run for `v<version>` has succeeded

#### Scenario: preparation resumes after Release succeeds

- **WHEN** the `Release` workflow for `v<version>` completes successfully
- **AND** the protected branch tip's manifest version is `<version>` with tag `v<version>` present
- **THEN** Release Please automation MUST be allowed to run
- **AND** it MUST open or update the Release PR for the next version when a bump is warranted

#### Scenario: a run queued behind the release commit does not prepare

- **GIVEN** an ordinary commit and a release commit are pushed to `main` in close succession
- **AND** the run for the ordinary commit checks out a commit that predates the release commit
- **WHEN** that run resolves the branch seal state from the tip and finds the manifest version untagged
- **THEN** release-please MUST NOT run in that run
- **AND** preparation MUST be left to a later sealed evaluation

#### Scenario: sealing failure or unfinished Release blocks preparation

- **WHEN** the tag-release job fails, is skipped, or times out waiting for protected-branch push CI
- **OR** the tag exists but no successful Release workflow run for that tag is evident
- **THEN** release-please MUST NOT run
- **AND** the next sealed evaluation MUST retry before preparation

#### Scenario: an ordinary push on a sealed branch prepares normally

- **WHEN** a commit that is not a release commit is pushed to `main`
- **AND** the tag for the current manifest version exists
- **AND** a Release workflow run for that tag has succeeded
- **THEN** release-please MUST run and open or update the Release PR for the next version
