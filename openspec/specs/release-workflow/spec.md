# release-workflow Specification

## Purpose

Define the complete release contract for `quantex-cli` and `quantex-core`: release-please Release PRs on protected branches, PR release intent and note input, deterministic tag creation after manually merged Release PRs, tag-triggered publication, protected-branch gate alignment, and independent Core package publication.
## Requirements
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

### Requirement: PRs Must Declare Release Intent

Every pull request SHALL include a dedicated release-intent section in its body.

#### Scenario: PR body is validated

- **WHEN** PR Governance validates a pull request body
- **THEN** it requires a `## Release Intent` section alongside the standard summary, artifacts, validation, docs, scope, and closure sections.

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

### Requirement: Process-only PRs MUST use the shared scope taxonomy for release-metadata enforcement

PR governance SHALL determine whether a pull request is process-only by using the same canonical repository taxonomy as merge-gating CI before enforcing release-metadata restrictions.

#### Scenario: Process-only PR changes workflow or OpenSpec files

- **WHEN** a pull request changes only files classified as process-only by the canonical repository taxonomy
- **THEN** PR governance MUST treat the pull request as process-only for release-metadata enforcement
- **AND** it MUST reject release-worthy conventional metadata such as `feat:`, `fix:`, or `perf:` for that scope

### Requirement: Product-Impacting PRs Must Not Silently Skip Release

PR Governance SHALL reject product-impacting pull requests whose title is not release-worthy unless the PR explicitly declares that release is not applicable with a non-placeholder reason. The product-impacting determination MUST use the same canonical repository taxonomy as merge-gating CI.

#### Scenario: Product-impacting PR has release-worthy title

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title uses release-worthy conventional metadata such as `feat:`, `fix:`, `perf:`, `type!:` or a breaking-change footer
- **THEN** PR Governance allows the release intent check to pass.

#### Scenario: Product-impacting PR has explicit no-release reason

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title is not release-worthy
- **AND** its release-intent section says release is not applicable with a meaningful reason
- **THEN** PR Governance allows the release intent check to pass.

#### Scenario: Product-impacting PR has non-release title and no reason

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title is not release-worthy
- **AND** its release-intent section is missing, empty, or only says a placeholder such as `n/a`
- **THEN** PR Governance fails with guidance to use release-worthy metadata or provide a reason.

### Requirement: PR body governance MUST be locally executable

The repository SHALL expose PR body governance as a local script used by both contributors and GitHub Actions. The script SHALL validate required PR sections, linked artifacts, process-only release metadata, and product-impacting release intent using the canonical repository taxonomy.

#### Scenario: Contributor validates a PR body locally

- **WHEN** a contributor or agent prepares a PR body
- **THEN** they can run the local PR body governance command with the body, title, and changed file list
- **AND** the command reports the same required-heading and linked-artifact failures that PR Governance would report remotely

#### Scenario: GitHub validates a PR body

- **WHEN** PR Governance runs for a pull request
- **THEN** it invokes the shared local PR body governance script
- **AND** it does not maintain an independent copy of the required-heading or release-intent logic inline in workflow YAML

### Requirement: PR body governance MUST be run before PR delivery actions

Agents and contributors SHALL run the local PR body governance command before creating a pull request or editing a pull request body when they provide a body manually. The repository SHALL prefer native GitHub CLI PR commands with a validated body file over repo-local commands that wrap PR creation.

#### Scenario: Agent creates a pull request

- **GIVEN** an agent has prepared a branch for PR delivery
- **WHEN** the agent writes the pull request body
- **THEN** it MUST write the body to a file based on `.github/pull_request_template.md`
- **AND** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr create --body-file <body-file>`

#### Scenario: Agent edits a pull request body

- **GIVEN** an agent needs to update an existing pull request body
- **WHEN** the agent prepares the replacement body manually
- **THEN** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr edit --body-file <body-file>`

#### Scenario: PR body preflight is skipped

- **GIVEN** a pull request body is malformed or missing required governance sections
- **WHEN** local preflight is skipped
- **THEN** GitHub Actions PR governance in `ci.yml` MUST still evaluate the same PR body policy and fail the pull request before merge

### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** the Release PR validator validates the release branch, title, generated marker, and changed file scope
- **AND** it rejects a generated Release PR whose proposed semantic version is less than or equal to the current version on the protected base branch
- **AND** it rejects a generated stable Release PR that promotes a `0.x` base version directly to `1.0.0`
- **AND** it rejects a generated stable Release PR whose proposed version is a repository-recorded burned release version

### Requirement: Major version bumps SHALL require explicit maintainer declaration

A Release PR whose proposed stable version crosses to a new major from a non-zero-major base SHALL be rejected unless the Release PR body carries an explicit maintainer-added `Release-As: <proposed version>` declaration.

#### Scenario: Undeclared major bump is rejected

- **WHEN** a generated stable Release PR proposes a new major version over a `1.x` or later base
- **AND** its body does not declare `Release-As: <proposed version>`
- **THEN** the Release PR validator MUST fail with guidance that a maintainer must explicitly approve the new major

#### Scenario: Declared major bump proceeds

- **WHEN** a generated stable Release PR proposes a new major version over a `1.x` or later base
- **AND** its body declares `Release-As: <proposed version>`
- **THEN** the major-bump check passes

### Requirement: Pull request delivery MUST prefer linear history

For ordinary repository pull requests, maintainers and agents MUST select rebase merge first and MAY use squash merge only when rebase is unavailable or unsafe. They MUST NOT select a merge commit or enable automatic merge merely to bypass explicit merge-time verification.

#### Scenario: A ready pull request can be rebased safely

- **GIVEN** the approved pull request head is unchanged and every required check passes
- **WHEN** the pull request is merged
- **THEN** the operator MUST prefer rebase merge
- **AND** the resulting protected-branch history remains linear

#### Scenario: Rebase merge is unavailable or unsafe

- **GIVEN** every required check passes but GitHub or the approved content topology cannot safely use rebase merge
- **WHEN** the operator selects a fallback
- **THEN** squash merge MAY be used after the fallback reason is recorded
- **AND** a merge commit MUST NOT be selected automatically

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

### Requirement: Tag push SHALL trigger publish without redundant merge gates

When a `v*` tag is pushed, `release.yml` SHALL validate the immutable release identity, build, verify release artifacts, smoke-test, and publish to npm and GitHub Release without re-running lint, typecheck, or vitest gates already enforced at merge.

#### Scenario: tag publish runs artifact pipeline only

- **WHEN** a `v<version>` tag is pushed
- **THEN** `release.yml` MUST run the release-candidate pipeline (seal validation, build, `release:artifacts`, `release:smoke`, package checks, candidate staging, candidate verification) and npm/GitHub publish
- **AND** it MUST NOT require lint, format:check, typecheck, or test jobs to pass again

### Requirement: The release-candidate pipeline SHALL be locally exercisable

The repository SHALL expose `bun run release:dry-run` so maintainers and agents can exercise the build-candidate chain locally without a tag or publication. CI MUST run the same pipeline definition in strict mode so the local and CI paths cannot diverge.

#### Scenario: maintainer exercises the release path locally

- **WHEN** a maintainer runs `bun run release:dry-run` on a checkout with installed dependencies
- **THEN** the pipeline runs build, binary build, artifact generation, smoke verification, Core package checks, candidate staging, and candidate verification
- **AND** it skips GitHub release-identity validation that requires a real tag

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the primary `quantex-cli` npm package and attach generated compressed standalone binary archives to the GitHub Release without dispatching synchronization for the separate `quantex` npm package from this repository.

#### Scenario: release publishes compressed standalone artifacts

- **WHEN** a release publish run has created the GitHub Release and generated standalone artifacts are ready to upload
- **THEN** it MUST upload one archive for every supported platform and architecture
- **AND** macOS and Linux assets MUST use the `.tar.gz` format
- **AND** the Windows executable asset MUST use the `.zip` format
- **AND** each archive MUST contain exactly its corresponding standalone executable
- **AND** `manifest.json` and `SHA256SUMS.txt` MUST reference and checksum the uploaded archives
- **AND** it MUST NOT dispatch synchronization events to external `quantex` packages

### Requirement: Generated Release PRs satisfy governance sections

Release PRs generated by release-please SHALL include the same governance sections required from normal PRs.

#### Scenario: stable Release PR is generated

- **WHEN** release-please creates or updates a stable Release PR
- **THEN** the PR body MUST include a `## Closure Check` section

### Requirement: Protected branches SHALL require aligned status check contexts

The `main` protected branch SHALL require status check contexts that match the consolidated CI workflow job names and actually run on pull requests: `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, and `test (macos-latest)`. The `classify` job SHALL NOT be a required context. The `sandbox-tests` workflow SHALL remain advisory and SHALL NOT be a required context.

There is no second protected release branch to mirror: `beta` ceased to be a release channel, and the prerelease-from-main requirement was removed after its release-please mechanism was disproved. The frozen `v1.8.2-beta` tag is registry state rather than repository state; the npm `beta` dist-tag was removed by a maintainer, so no preview dist-tag is currently maintained.

#### Scenario: main branch protection matches CI job names

- **WHEN** a maintainer inspects branch protection for `main`
- **THEN** the required contexts MUST be exactly the five consolidated CI job names
- **AND** `classify` and `sandbox-tests` MUST NOT appear among them

### Requirement: Skipped required checks SHALL not block merge

When a required status check job is legitimately skipped (for example, platform test jobs on process-only changes), GitHub ruleset semantics SHALL treat the skipped check as passing and MUST NOT block merge.

#### Scenario: skipped platform test on process-only pull request

- **WHEN** a process-only pull request skips a required platform test job
- **AND** other required checks pass
- **THEN** the pull request MUST remain mergeable

### Requirement: Core publication is independent and OIDC-backed

The repository SHALL publish `quantex-core` only through a manually dispatched `release-core.yml` workflow with GitHub Actions OIDC. The workflow MUST not require an npm token, invoke CLI release-please, create a GitHub Release, upload standalone binaries, or gate CLI publication on Core registry state.

#### Scenario: maintainer dispatches a Core release

- **WHEN** a maintainer dispatches `Release Core` for `main`
- **THEN** the workflow builds and validates only the Core package contract before publishing
- **AND** npm receives an OIDC-authenticated `quantex-core` publish without a long-lived npm credential

#### Scenario: Core publication is unavailable

- **WHEN** Core registry inspection or publication fails
- **THEN** the workflow fails without publishing an ambiguous version
- **AND** `release.yml` remains able to publish and recover `quantex-cli` independently

### Requirement: Core releases use immutable, idempotent recovery sources

The Core release workflow MUST use `core-v<version>` as its immutable source tag and inspect `quantex-core@<version>` before publishing. It MUST configure a deterministic Git committer identity before creating an annotated source tag, reject a tag pointing at another commit, and treat an exact existing npm version as already published.

#### Scenario: the immutable source tag does not yet exist

- **WHEN** a maintainer dispatches Core release for a version without `core-v<version>`
- **THEN** the workflow configures its Git committer identity and creates an annotated tag at the selected source commit
- **AND THEN** it pushes that tag before Core package validation and publication

#### Scenario: a Core release is retried

- **WHEN** a maintainer dispatches Core release after an interrupted publish
- **THEN** the workflow reuses the existing matching `core-v<version>` tag
- **AND** it publishes only if the exact package version is conclusively absent

#### Scenario: tag and requested source disagree

- **WHEN** `core-v<version>` points at a different commit from the selected source
- **THEN** the workflow fails before npm publication

### Requirement: A Core release SHALL precede dependent CLI releases

When a CLI release depends on a new `quantex-core` version, the maintainer SHALL publish that Core version through `release-core.yml` before the CLI Release PR merges, because CLI release automation consumes `quantex-core` as a pinned registry dependency.

#### Scenario: CLI release needs a new Core version

- **WHEN** `package.json` pins a `quantex-core` version that is not yet on npm
- **THEN** the maintainer MUST dispatch the Core release first
- **AND** the CLI release candidate pipeline MUST NOT be expected to succeed before Core is published

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

- **WHEN** the release-please `pull-request-header` template is validated by PR body governance
- **THEN** it MUST report no policy issues, so generated Release PRs pass the same gate as human pull requests

### Requirement: A prerelease version SHALL never be published to the latest dist-tag

There is no prerelease channel. If a version carrying a prerelease suffix is ever produced, publication SHALL route it to the `beta` npm dist-tag rather than `latest`, so that a preview build can never displace the current stable release for ordinary installs.

This is a fail-safe rather than a feature: nothing in the repository is expected to produce such a version. It is stated so the version-to-dist-tag derivation in the release identity contract is not removed later as unreachable code.

#### Scenario: Stable release publishes to latest

- **WHEN** a release commit for a version without a prerelease suffix is published
- **THEN** publication MUST use the `latest` npm dist-tag

#### Scenario: A prerelease version is published defensively

- **WHEN** a version carrying a prerelease suffix reaches publication
- **THEN** publication MUST use the `beta` npm dist-tag
- **AND** it MUST NOT be published to `latest`

### Requirement: Published releases MUST exercise the documented standalone installers

After the release workflow makes the exact GitHub Release public, it SHALL run a non-cancelling matrix against that same immutable `v<version>` release. The matrix MUST run the versioned `install.sh` on at least one hosted Linux runner and one hosted macOS runner, and MUST run the versioned `install.ps1` on a hosted Windows runner. Each leg SHALL set the repository and release tag explicitly, install into an isolated scratch directory, and verify that the installed primary executable and documented alias run successfully and report the expected release version.

#### Scenario: A published stable release exercises every documented installer

- **WHEN** `release.yml` completes public GitHub Release closure for `v<version>`
- **THEN** it MUST run the release-tagged `install.sh` on Linux and macOS
- **AND** it MUST run the release-tagged `install.ps1` on Windows
- **AND** each installer MUST download from the exact `v<version>` release rather than an unpinned `latest` release

#### Scenario: POSIX installer smoke succeeds

- **GIVEN** the public release contains the platform archive and `SHA256SUMS.txt`
- **WHEN** a Linux or macOS matrix leg runs `install.sh` in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex` and `qtx` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: Windows installer smoke succeeds

- **GIVEN** the public release contains `quantex-windows-x64.exe.zip` and `SHA256SUMS.txt`
- **WHEN** the Windows matrix leg runs `install.ps1` in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex.exe` and `qtx.exe` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: An installer cannot consume the published release

- **WHEN** any installer matrix leg cannot download, verify, extract, or execute the exact release
- **THEN** that leg MUST fail the release workflow
- **AND** its failure MUST identify the installer and hosted runner that failed
- **AND** the other matrix legs MUST still be allowed to report their own result

#### Scenario: Post-publish installer verification fails

- **WHEN** the installer matrix fails after the GitHub Release, tag, or npm version is public
- **THEN** the release workflow MUST remain failed and report the release as not fully verified
- **AND** it MUST NOT delete, move, or retag the immutable release to hide the failure
- **AND** maintainers MUST be able to rerun the same tag after transient remediation or a corrective change
