# Runbook: Releasing Quantex With Release PRs

## Purpose

Provide the canonical release procedure now that Quantex releases are prepared by release-please Release PRs and published from protected `main`.

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

### 2. Explicitly prepare the Release PR

After required CI is green, a maintainer dispatches the `Prepare Release` workflow for `main` or `beta`.

The preparation resolver only decides whether successful release-worthy history warrants a Release PR. It never inspects npm, selects a publication candidate, creates a tag, or publishes artifacts.

release-please then maintains a Release PR when a version bump is warranted.

The Release PR materializes the pending version in:

- `CHANGELOG.md`
- `package.json`
- `.release-please-manifest.json`
- `src/generated/build-meta.ts`

### 3. Review and merge the Release PR manually

The Release PR is the review point for the exact version and changelog that will be published. Required checks and human review decide its merge.

Confirm that the PR:

- comes from this repository
- uses the expected release-please branch for `main` or `beta`
- has the expected release title shape
- includes the release-please generated marker
- only changes `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`
- contains one maintainer-authored commit rather than the release bot's original commit metadata

Before merge, check out the generated branch with maintainer credentials, replace its commits with one commit authored by the maintainer, and force-push that branch with lease protection. PR Governance deliberately rejects the trusted release bot author as well as other bot or agent identities because GitHub squash can synthesize prohibited `Co-authored-by:` trailers.

Merge the locked reviewed head manually; prefer rebase and use squash only when rebase is unavailable or unsafe.

### 4. Seal the exact protected-branch head

After the Release PR is merged, wait for push CI to succeed on that exact `main` or `beta` head. Then dispatch `Seal Release` for the same protected branch.

Sealing requires all of these values to agree before creating or reusing a tag:

- protected-branch head SHA
- successful push CI SHA
- `chore: release <version>` commit title
- root `package.json` version
- `v<version>` tag
- stable `main`/`latest` or prerelease `beta`/`beta` channel

An existing tag is accepted only when it already points to the exact validated commit. The workflow never moves a version tag.

### 5. Build and publish the sealed candidate

After sealing, `Seal Release` explicitly dispatches `Release` at the tag. The explicit dispatch is required because a tag pushed with `GITHUB_TOKEN` does not trigger another workflow.

The tag-only Release workflow reruns:

- `bun run memory:check`
- `bun run lint`
- `bun run format:check`
- `bun run typecheck`
- `bun run test`

This keeps publish gating inside the workflow that npm trusts for OIDC publishing.

It then builds the package and binaries once, compresses each standalone binary as a `.tar.gz` archive, generates the manifest and checksums for those archives, smoke-checks them, packs the exact npm tarball with scripts disabled, and uploads one release-candidate Actions artifact. A separate mutation job downloads that artifact without checking out source or rebuilding.

After a fail-closed exact-version registry preflight, the mutation order is:

1. create or recover the draft GitHub Release;
2. upload and verify every candidate asset by name and size;
3. publish the exact candidate tarball when the preflight found no existing version;
4. verify npm registry closure;
5. make the GitHub Release public.

Regular merges never publish by themselves. Preparation cannot publish, and Release cannot infer a commit from branch history.

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

`refactor:` entries appear in the generated `Internal Improvements` section but do not independently trigger a version bump. When an exact one-shot version is needed, carry `Release-As: <version>` in the merged commit and repeat the same footer in the source PR's Release Summary. The protected-branch resolver recognizes that footer as a Release PR trigger, so do not add `!` or a false `BREAKING CHANGE` marker merely to start release automation.

The stable 0.x line ends at `0.29.1`. The completed lifecycle redesign graduates through the exact transition `0.29.1 -> 1.1.0`; `1.0.0` remains burned and MUST NOT be reused. The graduation implementation commit uses release-please's one-shot `Release-As: 1.1.0` footer, after which normal 1.x SemVer planning resumes. Do not persist `release-as` in release-please configuration and do not manually edit the version manifest, package version, changelog, or generated build metadata to imitate the generated Release PR.

Both the graduation implementation PR and the generated `chore: release 1.1.0` PR use the normal protected-branch checks. Every Release PR is manually reviewed and merged with a locked head; rebase is preferred and squash remains the fallback only when rebase is unavailable or unsafe.

Release automation, documentation, and project-memory-only PRs must use non-release-worthy titles such as `ci:`, `chore:`, or `docs:`. PR Governance rejects release-worthy titles for PRs that only change `.github/`, `docs/`, `openspec/`, or release-please configuration files, because those changes should not create stable product releases by themselves.

The stable release-please config currently includes a temporary `last-release-sha` anchor to exclude a historical release-process `feat(release)` commit from stable release calculation. Remove or advance that anchor after the next intentional stable Release PR is merged, because release-please treats `last-release-sha` as an explicit scan boundary until it is changed.

The Release workflow pins `googleapis/release-please-action` to a repository-verified tag instead of floating on the major `v4` tag. Before changing that pin, run a dry run against the repository and confirm it can prepare the expected Release PR without GitHub GraphQL errors.

release-please owns only Release PR preparation. Tag sealing and publication do not ask release-please to rediscover or create a GitHub Release.

If preparation fails, rerun `Prepare Release` for the branch. If sealing fails before tag creation, fix the protected-branch or CI mismatch and rerun `Seal Release`. If any later step fails, redispatch `Release` with `--ref v<version>` or rerun the failed workflow at the same tag. Never create a replacement version commit merely to recover incomplete npm or GitHub assets.

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

## Important automation note

Do not assume a workflow-created tag or GitHub Release should trigger a second publish workflow.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`.

That is why `Seal Release` explicitly runs `gh workflow run release.yml --ref "v<version>"` after creating or verifying the tag. The publish workflow validates the tag again rather than trusting the dispatch source.

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

- `RELEASE_APP_ID` stores the GitHub App numeric application ID.
- `RELEASE_APP_PRIVATE_KEY` stores the GitHub App private key PEM.
- `.github/workflows/release-please.yml` uses `actions/create-github-app-token` to create or update Release PRs on push.
- `.github/workflows/release.yml` uses `actions/create-github-app-token` to create or recover releases and upload artifacts.

The GitHub App should be installed only on `Drswith/quantex-cli` and only needs repository permissions for read-only actions/metadata plus read-write contents, issues, and pull requests.

Do not use `GITHUB_TOKEN` as the normal release identity because GitHub suppresses many workflow events created by `GITHUB_TOKEN`.

## Validation

The closest local verification path for release artifacts remains:

```bash
bun install --frozen-lockfile
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run build:bin
bun run release:artifacts
bun run release:smoke
bun run package:check
```

`release:artifacts` must fail if the release manifest is missing any required platform archive. Each archive contains the corresponding executable:

- `quantex-darwin-arm64.tar.gz`
- `quantex-darwin-x64.tar.gz`
- `quantex-linux-arm64.tar.gz`
- `quantex-linux-x64.tar.gz`
- `quantex-windows-x64.exe.tar.gz`

`package:check` must fail if the managed-install tarball still contains any `dist/bin/` entries after `build:bin` has populated standalone release outputs.

## CI coverage split

The main `CI` workflow uses a split Windows strategy to keep pull requests responsive without dropping protected-branch confidence.

- `pull_request` runs still install dependencies and build on `windows-latest`, but they skip the full Windows test step.
- `push` to `main` or `beta`, `workflow_dispatch`, and the scheduled CI run keep the full Windows test step enabled.
- `ubuntu-latest` and `macos-latest` continue to run the full test suite for pull requests.

If Windows coverage policy changes again, update `.github/workflows/ci.yml` and this runbook in the same change so release and workflow expectations stay aligned.

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
