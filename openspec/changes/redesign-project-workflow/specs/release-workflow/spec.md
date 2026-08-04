# release-workflow Delta

## ADDED Requirements

### Requirement: PRs Must Declare Release Intent

Every pull request SHALL include a dedicated release-intent section in its body.

#### Scenario: PR body is validated

- **WHEN** PR Governance validates a pull request body
- **THEN** it requires a `## Release Intent` section alongside the standard summary, artifacts, validation, docs, scope, and closure sections.

### Requirement: Release-source PRs MUST provide release-please consumable summaries

Every non-generated pull request with release-worthy metadata SHALL include a `## Release Summary` section containing a non-empty `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` block with at least one conventional-commit entry suitable for user-facing release notes.

#### Scenario: Release source omits the summary

- **WHEN** a non-generated PR uses release-worthy metadata
- **AND** its Release Summary is missing, blank, malformed, or contains only a placeholder override
- **THEN** PR governance MUST reject the PR before merge with guidance to provide a release-please commit override

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

PR Governance SHALL reject product-impacting pull requests whose title is not release-worthy unless the PR explicitly declares that release is not applicable with a non-placeholder reason.

#### Scenario: Product-impacting PR has non-release title and no reason

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title is not release-worthy
- **AND** its release-intent section is missing, empty, or only says a placeholder such as `n/a`
- **THEN** PR Governance fails with guidance to use release-worthy metadata or provide a reason.

### Requirement: PR body governance MUST be locally executable

The repository SHALL expose PR body governance as a local script used by both contributors and GitHub Actions.

#### Scenario: GitHub validates a PR body

- **WHEN** PR Governance runs for a pull request
- **THEN** it invokes the shared local PR body governance script
- **AND** it does not maintain an independent copy of the required-heading or release-intent logic inline in workflow YAML

### Requirement: PR body governance MUST be run before PR delivery actions

Agents and contributors SHALL run the local PR body governance command before creating a pull request or editing a pull request body when they provide a body manually.

#### Scenario: Agent creates a pull request

- **GIVEN** an agent has prepared a branch for PR delivery
- **WHEN** the agent writes the pull request body
- **THEN** it MUST write the body to a file based on `.github/pull_request_template.md`
- **AND** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr create --body-file <body-file>`

### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** the Release PR validator validates the release branch, title, generated marker, and changed file scope
- **AND** it rejects versions not greater than the base version, direct `0.x` to `1.0.0` promotions, and burned release versions

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

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

Repository CI SHALL reject newly introduced commits containing `Co-authored-by:` trailers on pull requests and protected-branch pushes, and SHALL reject pull requests whose commit metadata risks synthesized co-author trailers on squash merge. The merge commit policy validator SHALL fail when no commit metadata is supplied. Release-please branches are exempt from the Release-As commit-footer consistency check because generated release commits never carry source-PR footers.

#### Scenario: Protected-branch push introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a direct push to a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before downstream release automation treats the push as releasable history
- **AND** it reports the offending commit SHA and trailer line

### Requirement: Pull request delivery MUST prefer linear history

For ordinary repository pull requests, maintainers and agents MUST select rebase merge first and MAY use squash merge only when rebase is unavailable or unsafe.

#### Scenario: A ready pull request can be rebased safely

- **GIVEN** the approved pull request head is unchanged and every required check passes
- **WHEN** the pull request is merged
- **THEN** the operator MUST prefer rebase merge
- **AND** the resulting protected-branch history remains linear

### Requirement: The release-candidate pipeline SHALL be locally exercisable

The repository SHALL expose `bun run release:dry-run` so maintainers and agents can exercise the build-candidate chain locally without a tag or publication. CI MUST run the same pipeline definition in strict mode so the local and CI paths cannot diverge.

#### Scenario: maintainer exercises the release path locally

- **WHEN** a maintainer runs `bun run release:dry-run` on a checkout with installed dependencies
- **THEN** the pipeline runs build, binary build, artifact generation, smoke verification, Core package checks, candidate staging, and candidate verification
- **AND** it skips GitHub release-identity validation that requires a real tag

### Requirement: Core publication is independent and OIDC-backed

The repository SHALL publish `quantex-core` only through a manually dispatched `release-core.yml` workflow with GitHub Actions OIDC, without an npm token, CLI release-please involvement, a GitHub Release, standalone binaries, or CLI publication gating on Core registry state.

#### Scenario: maintainer dispatches a Core release

- **WHEN** a maintainer dispatches `Release Core` for `main`
- **THEN** the workflow builds and validates only the Core package contract before publishing
- **AND** npm receives an OIDC-authenticated `quantex-core` publish without a long-lived npm credential

### Requirement: Core releases use immutable, idempotent recovery sources

The Core release workflow MUST use `core-v<version>` as its immutable source tag and inspect `quantex-core@<version>` before publishing, reject a tag pointing at another commit, and treat an exact existing npm version as already published.

#### Scenario: a Core release is retried

- **WHEN** a maintainer dispatches Core release after an interrupted publish
- **THEN** the workflow reuses the existing matching `core-v<version>` tag
- **AND** it publishes only if the exact package version is conclusively absent

### Requirement: A Core release SHALL precede dependent CLI releases

When a CLI release depends on a new `quantex-core` version, the maintainer SHALL publish that Core version through `release-core.yml` before the CLI Release PR merges.

#### Scenario: CLI release needs a new Core version

- **WHEN** `package.json` pins a `quantex-core` version that is not yet on npm
- **THEN** the maintainer MUST dispatch the Core release first
- **AND** the CLI release candidate pipeline MUST NOT be expected to succeed before Core is published

## MODIFIED Requirements

### Requirement: Tag push SHALL trigger publish without redundant merge gates

When a `v*` tag is pushed, `release.yml` SHALL validate the immutable release identity, build, verify release artifacts, smoke-test, and publish to npm and GitHub Release without re-running lint, typecheck, or vitest gates already enforced at merge.

#### Scenario: tag publish runs artifact pipeline only

- **WHEN** a `v<version>` tag is pushed
- **THEN** `release.yml` MUST run the release-candidate pipeline (seal validation, build, `release:artifacts`, `release:smoke`, package checks, candidate staging, candidate verification) and npm/GitHub publish
- **AND** it MUST NOT require lint, format:check, typecheck, or test jobs to pass again

### Requirement: Release tagging SHALL seal merged Release PRs deterministically

Because release-please runs with `skip-github-release: true` and maintainers re-author Release PR branches before merge, a dedicated `tag-release` job SHALL run after release-please on each protected-branch push. When the branch head is a `chore: release <version>` commit, the manifest version has no tag at that commit, and the branch-head push CI run succeeded, the job SHALL create and push `v<version>` with `git push` under the release GitHub App token so the tag event triggers `release.yml` exactly once, then relabel the merged release PR from `autorelease: pending` to `autorelease: tagged`. A workflow dispatch MAY be used only as a fallback after polling shows the tag event did not trigger the Release workflow.

#### Scenario: manually merged Release PR receives tag after CI

- **WHEN** a release-please Release PR is merged manually to `main` or `beta`
- **AND** the branch head commit title is `chore: release <version>`
- **AND** push CI succeeded on that commit
- **AND** tag `v<version>` does not exist at the branch head
- **THEN** the tag-release job MUST push tag `v<version>` at the branch head through `git push`
- **AND** it MUST relabel the merged release PR to `autorelease: tagged`

#### Scenario: tag push is the primary release trigger

- **WHEN** the tag-release job pushes tag `v<version>`
- **THEN** it MUST NOT unconditionally dispatch `release.yml`
- **AND** it MAY dispatch `release.yml` only when polling shows no Release workflow run was created for the pushed tag

#### Scenario: tag-release is a no-op when tag already exists

- **WHEN** tag `v<version>` already points at the branch head release commit
- **THEN** the tag-release job MUST NOT create a duplicate tag
- **AND** it MAY relabel a stale `autorelease: pending` release PR to unblock release-please

### Requirement: Protected branches SHALL require aligned status check contexts

`main` and `beta` protected branches SHALL require status check contexts that match the consolidated CI workflow job names and actually run on pull requests: `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, and `test (macos-latest)`. The `classify` job SHALL NOT be a required context. The `sandbox-tests` workflow SHALL remain advisory and SHALL NOT be a required context.

#### Scenario: main branch ruleset contexts

- **WHEN** a maintainer inspects the `protect-main` ruleset
- **THEN** required status checks MUST include `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, and `test (macos-latest)`
- **AND** `classify` and `sandbox-tests` MUST NOT appear as required contexts

#### Scenario: beta branch has matching protection

- **WHEN** a maintainer inspects branch protection for `beta`
- **THEN** it MUST require the same five status check contexts as `main`

### Requirement: Skipped required checks SHALL not block merge

When a required status check job is legitimately skipped (for example, platform test jobs on process-only changes), GitHub ruleset semantics SHALL treat the skipped check as passing and MUST NOT block merge.

#### Scenario: skipped platform test on process-only pull request

- **WHEN** a process-only pull request skips a required platform test job
- **AND** other required checks pass
- **THEN** the pull request MUST remain mergeable

## REMOVED Requirements

### Requirement: Release tag backstop SHALL seal manually merged Release PRs

**Reason**: The "backstop" framing described a fix-on-fix patch; tagging after a manually merged Release PR is the designed mechanism and is restated as `Release tagging SHALL seal merged Release PRs deterministically` with a single-fire trigger guarantee.

**Migration**: Follow the renamed `tag-release` requirement and the `ci:tag-release` script; the `release-tag-backstop` name is retired.
