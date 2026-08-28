# Runbook: Releasing Quantex With Release PRs

## Purpose

Provide the canonical release procedure now that Quantex releases are prepared by release-please Release PRs, tagged deterministically after merge, and published from protected `main`.

## When to use

- you need to understand when Quantex will open a Release PR
- you need to verify whether a merged Release PR should publish
- you need to recover when the automated release workflow did not behave as expected

## Canonical release source

Quantex's source-controlled changelog lives in [CHANGELOG.md](../../CHANGELOG.md), which is maintained by release-please Release PRs. Published release pages and binary assets live in [GitHub Releases](https://github.com/Drswith/quantex-cli/releases).

The automated release flow uses merged commit metadata on `main` to decide whether to open or update a Release PR.

## Canonical flow

### 1. Merge normal work to `main`

Normal feature, fix, or maintenance work lands through standard PRs.

### 2. release-please maintains the Release PR automatically

On every push to `main`, `release-please.yml` first runs its `tag-release` job and then, only if that job reports the branch sealed, runs release-please with `release-please-config.json` to open or update the Release PR when a version bump is warranted. No manual dispatch is involved.

Sealed means the tag for the version in `.release-please-manifest.json` on the branch tip exists. release-please derives its commit range from that tag, and a missing tag is not an error to it: it drops the range boundary and replays the entire history, which re-admits settled `Release-As` footers and can compute a version below the published one. That is how [#677](https://github.com/Drswith/quantex-cli/pull/677) proposed `1.11.0` after `1.11.1` had shipped.

An unsealed branch therefore skips preparation rather than preparing something wrong. It is self-clearing: the push that merges a Release PR seals it, and anything that landed beside it is prepared by the next push.

Stable v2 is temporarily deferred until the required refactor has merged and completed at least 90 days of stabilization. That gate denies an ineligible version at Release PR validation, tag planning, and publication identity; it does not pause preparation, so ordinary 1.x Release PRs are created as usual.

The Release PR materializes the pending version in:

- `CHANGELOG.md`
- `package.json`
- `.release-please-manifest.json`
- `src/generated/build-meta.ts`

### 3. Review and merge the Release PR manually

The Release PR is the review point for the exact version and changelog that will be published. Required checks and human review decide its merge.

Confirm that the PR:

- comes from this repository
- uses the expected release-please branch for `main`
- has the expected release title shape
- includes the release-please generated marker
- only changes `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`
- carries the version the release is meant to publish

Before merge, review the generated branch and confirm the checklist above. Governance no longer rejects the release bot author, so re-authoring the branch is optional housekeeping rather than a merge requirement.

If the Release PR proposes a new major version on the stable line, governance fails until a maintainer adds a `Release-As: <version>` line to the Release PR body. This is the generic human gate for major version identity, but it cannot override a separate deferred-major readiness gate. In particular, stable `2.x` remains blocked even if `Release-As: 2.x.y` is added.

Merge the locked reviewed head manually; prefer rebase and use squash only when rebase is unavailable or unsafe.

### 4. Deterministic tag after push CI

After the Release PR merges, push CI on the exact `main` head must succeed. The `tag-release` job in `release-please.yml`, which runs before release-please in the same run, then:

- waits for a successful `ci.yml` push run on the branch head;
- pushes `v<version>` with `git push` under the release GitHub App token when the head is `chore: release <version>` and the tag is still missing (the normal case, because maintainers re-author Release PR branches and release-please runs with `skip-github-release: true`);
- dispatches `release.yml` at the pushed tag, because the tag event itself does not start publication for the bot (see the automation note below);
- relabels the merged release PR from `autorelease: pending` to `autorelease: tagged` so release-please is not blocked on the next cycle;
- publishes a `sealed` job output, read from the branch tip rather than from its own checkout, which gates whether release-please runs at all.

If the tag already points at the branch head, tag-release only relabels.

The seal read is deliberately taken from the tip. A run queued behind a later push plans against a checkout that predates the release commit, so it can correctly seal an older version while the branch has already moved on; answering from the checkout would report that stale run as sealed and hand release-please a manifest it has no tag for.

Publication identity still requires all of these values to agree before `release.yml` publishes:

- protected-branch head SHA
- successful push CI SHA
- `chore: release <version>` commit title
- root `package.json` version
- `v<version>` tag at the same SHA
- the npm dist-tag: `latest` for a stable version; `beta` only if a prerelease is deliberately published as a defensive mapping. The repository does not maintain a beta release line.

An existing tag is accepted only when it already points to the exact validated commit. The workflow never moves a version tag.

### 5. Tag-triggered publish

`release.yml` runs on the pushed `v<version>` tag. It does not rerun merge CI gates (lint, format, typecheck, or vitest).

The build-candidate job runs `bun run release:candidate`, the same pipeline definition maintainers can exercise locally with `bun run release:dry-run`: validate the immutable release identity, build the package and binaries once, compress each standalone binary as a `.tar.gz` archive, generate the manifest and checksums, smoke-check, verify the bundled Core package, stage the exact release candidate, and verify the candidate tarball. The publish job downloads that candidate, re-verifies every file against `candidate.json`, and then:

1. create or recover the draft GitHub Release;
2. upload and verify every candidate asset by name, size, and digest;
3. publish the exact candidate tarball when the registry preflight found no existing version;
4. verify npm registry closure;
5. make the GitHub Release public.

After the public-release check, the `verify-installers` matrix checks the same immutable tag on `ubuntu-latest`, `macos-latest`, and `windows-latest`. It checks out the tagged `install.sh` or `install.ps1`, passes the exact repository and tag through `QUANTEX_REPO` and `QUANTEX_VERSION`, installs into `runner.temp`, and runs both documented entry points with `--version`. The matrix uses `fail-fast: false`, so a multi-platform regression reports every affected installer.

This is a post-publish gate because the installers must use public `releases/download/<tag>` URLs. A failed installer leg makes the Release workflow fail and means installer verification is incomplete, but it does not delete, move, or retag the already-public GitHub Release, tag, or npm version. Inspect the named installer and runner first; if the failure is transient, rerun `Release` at the same `v<version>` tag, and if it identifies an asset or installer defect, land the corrective change before publishing a new version. Never hide the failure by moving an existing tag.

Regular source merges never publish by themselves. Only the immutable tag triggers publication.

## Version rules

Release PR creation uses conventional commits:

- `feat:` => minor release
- `fix:` => patch release
- `perf:` => patch release
- `BREAKING CHANGE:` footer or `!` => major release
- `docs:`, `test:`, `ci:`, `chore:` => no release unless the metadata is intentionally changed

Release-worthy source PRs MUST also provide a `## Release Summary` section with a non-empty release-please commit override. Use the override to write the changelog entry for users, rather than echoing incidental implementation wording:

```text
BEGIN_COMMIT_OVERRIDE
refactor: make agent lifecycle operations safer and easier to diagnose
END_COMMIT_OVERRIDE
```

`refactor:` entries appear in the generated `Internal Improvements` section but do not independently trigger a version bump. When an exact one-shot version is needed, carry `Release-As: <version>` in the merged commit and repeat the same footer in the source PR's Release Summary, **inside** the `BEGIN_COMMIT_OVERRIDE` block. Release-please replaces the merged commit message with that block on a squash-merge, so a footer placed after `END_COMMIT_OVERRIDE` is never parsed and the release is silently prepared at the computed version instead.

Never write the marker words anywhere else in a commit message or PR body, including in prose explaining this rule. Release-please parses only the text between the first pair it finds, so a stray mention changes which text that is; when the result is not a conventional commit it logs `commit could not be parsed` and drops the commit from the release along with any `Release-As` footer. `bun run pr:body:check` and the commit policy both reject stray markers for this reason.

Before opening a one-shot release PR, verify the declaration against release-please's own parser rather than trusting the text checks:

```bash
bun run release:verify-release-as -- --body-file <pr-body-file>
```

It reports the version release-please would actually release, and fails when the declaration would be inert. The `Verify a declared Release-As would take effect` step in `ci.yml` runs the same check on every pull request. The protected-branch resolver recognizes that footer as a Release PR trigger, so do not add `!` or a false `BREAKING CHANGE` marker merely to start release automation.

A one-shot is sometimes needed with no product change to attach it to. release-please computes the bump from every marker between the last release tag and `main`, so a marker whose change has since been undone keeps forcing that bump until a release lands after it. A pull request that only moves the boundary may carry `Release-As` while changing nothing but process or documentation files, provided the declared major is not above the current released major; a release-worthy title or a `BREAKING CHANGE` footer on such a PR is still rejected, and a higher major is rejected before any readiness gate is consulted. It must still supply a commit override under `## Release Summary`.

A breaking-change marker (`!` or `BREAKING CHANGE:`) feeds release-please a major bump. On the stable line the generated major Release PR is rejected by governance until a maintainer adds `Release-As: <version>` to its body, so an undeclared major cannot ship. A deferred-major readiness gate is stronger and remains blocking after that declaration.

The current stable-v2 gate is deny-by-default at three layers: generated stable-v2 PRs are rejected, deterministic tag planning fails before creating `v2.x.y`, and publication identity validation fails before candidate build. Release PR preparation itself is not paused, so an eligible 1.x release is never blocked as a side effect. Lift all layers together only through a future reviewed OpenSpec change that identifies the completed v2 refactor and records at least 90 elapsed days since it merged; there is no date-only automatic unlock.

The stable 0.x line ends at `0.29.1`. The completed lifecycle redesign graduates through the exact transition `0.29.1 -> 1.1.0`; `1.0.0` remains burned and MUST NOT be reused. Do not persist `release-as` in release-please configuration and do not manually edit the version manifest, package version, changelog, or generated build metadata to imitate the generated Release PR.

Release automation, documentation, and project-memory-only PRs must use non-release-worthy titles such as `ci:`, `chore:`, or `docs:`. PR Governance rejects release-worthy titles for PRs that only change `.github/`, `docs/`, `openspec/`, or release-please configuration files, because those changes should not create stable product releases by themselves.

The Release workflow pins `googleapis/release-please-action` to a repository-verified tag instead of floating on the major `v4` tag. Before changing that pin, run a dry run against the repository and confirm it can prepare the expected Release PR without GitHub GraphQL errors.

release-please owns Release PR preparation, but only after the branch is sealed. The `tag-release` job runs first, creates missing tags after CI, guarantees exactly one Release workflow trigger, and publishes the seal state that gates preparation; `release.yml` publishes on tag push and does not ask release-please to create a GitHub Release.

If no Release PR appears, read the `tag-release` job log first. Its last line reports the verdict — `Branch seal state: unsealed (v<version> does not exist yet)` means preparation was skipped on purpose because the current release is not tagged yet, and the next push retries. A skipped `release-please` job with a sealed branch is a different problem: check for stale `autorelease: pending` labels or an untagged merged Release PR. While the stable-v2 gate is active, absence of a Release PR is expected and must not be treated as an automation failure. If tag creation fails, fix the protected-branch, readiness, or CI mismatch and rerun `Release Please` on the branch. If publish or the post-publish installer gate fails after an eligible tag exists, rerun `Release` at the same tag or dispatch `release.yml` with `--ref v<version>` after inspecting the failure. Never create a replacement version commit merely to recover incomplete npm, GitHub, or installer verification closure, and never move an existing version tag.

## npm trusted publishing

Quantex publishes to npm through GitHub Actions trusted publishing with OIDC. The release workflow must keep `id-token: write` enabled and use a Node/npm version that supports trusted publishing.

That means:

- do not depend on `NPM_TOKEN` for the normal publish path
- make sure npm package settings point the trusted publisher at the exact workflow filename `.github/workflows/release.yml`
- keep the publish step in `.github/workflows/release.yml`
- use `npm publish --ignore-scripts` without a long-lived token after the workflow has already built and smoke checked the release artifacts

## Core SDK publishing

`quantex-core` is released independently from the CLI. Its npm trusted publisher MUST target GitHub user `Drswith`, repository `quantex-cli`, and workflow filename `release-core.yml` (not the CLI `release.yml`). The Core workflow uses OIDC and no `NPM_TOKEN`.

To publish or recover Core, dispatch **Release Core** for `main`. The workflow derives its version from `packages/core/package.json`, creates or verifies the immutable `core-v<version>` tag, validates the Core build and clean packed consumers, then inspects and publishes only `quantex-core@<version>`. A retry reuses the tag and skips publication only when that exact npm version already exists.

Do not add Core publishing to `release.yml`: CLI GitHub Releases, standalone binaries, release-please, and recovery remain CLI-only.

When a CLI release pins a new `quantex-core` version in `package.json`, publish Core first; the CLI release candidate pipeline consumes `quantex-core` from the registry.

## Important automation note

Do not assume a workflow-created tag or GitHub Release should trigger a second publish workflow.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`. A GitHub App token is exempt from that rule, but the bot's tag push does not benefit from the exemption: `actions/checkout` persists the default `GITHUB_TOKEN` into `.git/config` as an `http.https://github.com/.extraheader` credential, git sends that header on the first request, and the App token embedded in the push URL is only consulted after a `401` that never arrives. GitHub therefore attributes the tag push to `GITHUB_TOKEN` and starts nothing.

So `tag-release` dispatches `release.yml` itself right after pushing the tag. Every `release.yml` run since automation took over tagging has in fact been a `workflow_dispatch` run; the earlier polling grace period was waiting for a run that could not appear and expired in full on every release. `release.yml` keeps its `on: push: tags` trigger for tags a maintainer pushes by hand. If both paths ever fire for one tag, the non-cancelling per-tag concurrency group serialises them and the second run finds the exact version already published.

## Repository settings

The Release workflow depends on repository-level GitHub Actions settings, not only versioned YAML.

Required Actions workflow permissions:

- default workflow permissions: read and write
- allow GitHub Actions to create and approve pull requests: enabled

If this permission is disabled, release-please can calculate the next version and create its branch, but it fails when opening the Release PR with:

```text
GitHub Actions is not permitted to create or approve pull requests.
```

## Release PR checks

Release PRs are created by the configured release GitHub App. If GitHub marks a generated Release PR check as `action_required` with no jobs, verify the workflow still uses the GitHub App token instead of `GITHUB_TOKEN`, then close and reopen the Release PR from a maintainer account only as a recovery step.

For the non-interactive release flow, configure a dedicated GitHub App installation token:

- `RELEASE_APP_CLIENT_ID` stores the GitHub App client ID and is the `client-id` input both release workflows pass to `actions/create-github-app-token`.
- `RELEASE_APP_PRIVATE_KEY` stores the GitHub App private key PEM.
- `RELEASE_APP_ID` stores the GitHub App numeric application ID. It is unused: the action's `app-id` input is deprecated, and GitHub treats the application ID as a legacy JWT issuer.
- `.github/workflows/release-please.yml` uses `actions/create-github-app-token` to create or update Release PRs on push.
- `.github/workflows/release.yml` uses `actions/create-github-app-token` to create or recover releases and upload artifacts.

The GitHub App should be installed only on `Drswith/quantex-cli` and only needs repository permissions for read-only actions/metadata plus read-write contents, issues, and pull requests.

Do not use `GITHUB_TOKEN` as the normal release identity because GitHub suppresses many workflow events created by `GITHUB_TOKEN`.

## Validation

The full release-candidate chain is locally exercisable without a tag:

```bash
bun install --frozen-lockfile
bun run release:dry-run
```

This runs the same pipeline definition CI uses (`scripts/release/release-candidate.ts` in local mode): build, binary build, artifact generation, smoke verification, Core package checks, candidate staging, and candidate verification. Run it before changing any release script or workflow.

`release:artifacts` must fail if the release manifest is missing any required platform archive. Each archive contains the corresponding executable:

- `quantex-darwin-arm64.tar.gz`
- `quantex-darwin-x64.tar.gz`
- `quantex-linux-arm64.tar.gz`
- `quantex-linux-x64.tar.gz`
- `quantex-windows-x64.exe.tar.gz`

`package:check` must fail if the managed-install tarball still contains any `dist/bin/` entries after `build:bin` has populated standalone release outputs.

## CI coverage split

Every pull request that touches product-impacting paths runs the full test suite on all three platforms (`test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)`); process-only changes skip the platform matrix honestly and keep the Ubuntu build guard plus package checks. Required merge gates are `lint`, `governance`, and the three platform test contexts. `sandbox-tests` is advisory signal, not a required check.

If coverage policy changes again, update `.github/workflows/ci.yml`, this runbook, and the `code-quality-tooling` spec in the same change so release and workflow expectations stay aligned.

## Registry expectations

Repository-controlled dependency resolution should use the official npm registry unless there is an explicit, documented override for a specific environment.

- `.npmrc` should point at `https://registry.npmjs.org/`
- `bun.lock` tarball URLs should stay on `https://registry.npmjs.org/`

If a mirror registry is introduced temporarily for local development or incident recovery, do not commit that override as the repository default without documenting the reason and rollout scope.

## Related artifacts

- `.github/workflows/release.yml`
- `.github/workflows/release-please.yml`
- `.github/workflows/ci.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `docs/releases.md`
- `CHANGELOG.md`
- `docs/runbooks/release-and-self-upgrade-debugging.md`
- `docs/adr/0008-workflow-redesign.md`
- `docs/adr/0009-workflow-v2.md`
