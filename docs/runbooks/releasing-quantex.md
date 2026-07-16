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

### 2. Let release-please reconcile protected-branch release state

The `Release` workflow runs after successful push-side `CI` on `main` or `beta`, and it can also be invoked manually for the same protected branches.

Before it chooses an action, the workflow reconciles branch state from:

- successful push-side `CI` runs on the protected branch
- current branch history and tags
- whether a successful `chore: release ...` commit is still untagged

That resolver picks exactly one next action:

- publish a successful but still-untagged release commit
- otherwise create or refresh a Release PR from the newest successful release-worthy commit
- otherwise exit cleanly with no release action

release-please then maintains a Release PR when a version bump is warranted.

The Release PR materializes the pending version in:

- `CHANGELOG.md`
- `package.json`
- `.release-please-manifest.json`
- `src/generated/build-meta.ts`

### 3. Let Release PR Automerge validate the Release PR

The Release PR is the review point for the exact version and changelog that will be published. The `Release PR Automerge` workflow validates release-please generated PRs before enabling auto-merge.

It only enables auto-merge when the PR:

- comes from this repository
- uses the expected release-please branch for `main` or `beta`
- has the expected release title shape
- includes the release-please generated marker
- only changes `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`

Branch protection and required checks still decide when the Release PR actually merges.

### 4. Let the release job validate the merged Release PR

After the Release PR is merged, the release workflow waits for the successful push-side `CI` run that covers that merged release commit before it enters publish mode. A later docs or archive push must not steal priority from an already-green untagged release commit.

When the reconciler selects publish mode, the release workflow reruns:

- `bun run memory:check`
- `bun run lint`
- `bun run format:check`
- `bun run typecheck`
- `bun run test`

This keeps publish gating inside the workflow that npm trusts for OIDC publishing.

### 5. Publish automatically

When release-please reports that a GitHub Release was created, the workflow:

- builds binaries
- generates release artifacts
- runs `release:smoke`
- runs `package:check`
- publishes to npm
- uploads binaries to the GitHub Release

For regular non-release merges to `main`, the workflow exits cleanly unless it also finds a successful untagged release commit that still needs publication.

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

Both the graduation implementation PR and the generated `chore: release 1.1.0` PR use the normal protected-branch checks. The Release PR workflow MUST identify that exact generated PR from base version `0.29.1` and skip token creation and auto-merge enablement, leaving the PR fail-closed for a locked-head manual rebase merge. Squash remains the fallback only when rebase is unavailable or unsafe.

Release automation, documentation, and project-memory-only PRs must use non-release-worthy titles such as `ci:`, `chore:`, or `docs:`. PR Governance rejects release-worthy titles for PRs that only change `.github/`, `docs/`, `openspec/`, or release-please configuration files, because those changes should not create stable product releases by themselves.

The stable release-please config currently includes a temporary `last-release-sha` anchor to exclude a historical release-process `feat(release)` commit from stable release calculation. Remove or advance that anchor after the next intentional stable Release PR is merged, because release-please treats `last-release-sha` as an explicit scan boundary until it is changed.

The Release workflow pins `googleapis/release-please-action` to a repository-verified tag instead of floating on the major `v4` tag. Before changing that pin, run a dry run against the repository and confirm it can prepare the expected Release PR without GitHub GraphQL errors.

Release PR creation and GitHub Release creation run as separate release-please phases. Product merges use Release PR mode, while `chore: release ...` merges use GitHub Release mode and then continue into build, npm trusted publishing, and artifact upload.

If a maintainer needs to recover release automation manually, use `workflow_dispatch` against the protected branch that needs reconciliation. Manual runs reuse the same branch-state resolver; they do not bypass the requirement that publish mode must come from a successful protected-branch `CI` run for the target release commit.

## npm trusted publishing

Quantex publishes to npm through GitHub Actions trusted publishing with OIDC. The release workflow must keep `id-token: write` enabled and use a Node/npm version that supports trusted publishing.

That means:

- do not depend on `NPM_TOKEN` for the normal publish path
- make sure npm package settings point the trusted publisher at the exact workflow filename `.github/workflows/release.yml`
- keep the publish step in `.github/workflows/release.yml`
- use `npm publish --ignore-scripts` without a long-lived token after the workflow has already built and smoke checked the release artifacts

## Important automation note

Do not assume a workflow-created tag or GitHub Release should trigger a second publish workflow.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`.

That is why Quantex performs release-please tagging, npm publish, and artifact upload inside the same release workflow.

## Repository settings

The Release workflow depends on repository-level GitHub Actions settings, not only versioned YAML.

Required Actions workflow permissions:

- default workflow permissions: read and write
- allow GitHub Actions to create and approve pull requests: enabled
- repository auto-merge: enabled

If this permission is disabled, release-please can calculate the next version and create its branch, but it fails when opening the Release PR with:

```text
GitHub Actions is not permitted to create or approve pull requests.
```

## Release PR checks

Release PRs are created by the configured release GitHub App. If GitHub marks a generated Release PR check as `action_required` with no jobs, verify the workflow still uses the GitHub App token instead of `GITHUB_TOKEN`, then close and reopen the Release PR from a maintainer account only as a recovery step.

For the non-interactive release flow, configure a dedicated GitHub App installation token:

- `RELEASE_APP_CLIENT_ID` stores the GitHub App client ID.
- `RELEASE_APP_PRIVATE_KEY` stores the GitHub App private key PEM.
- `.github/workflows/release.yml` uses `actions/create-github-app-token` to create or update Release PRs, create releases, and upload artifacts.
- `.github/workflows/release-pr-automerge.yml` uses the same GitHub App token to enable auto-merge for validated Release PRs.

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

`release:artifacts` must fail if the release manifest is missing any required platform binary:

- `quantex-darwin-arm64`
- `quantex-darwin-x64`
- `quantex-linux-arm64`
- `quantex-linux-x64`
- `quantex-windows-x64.exe`

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
- `.github/workflows/release-pr-automerge.yml`
- `.github/workflows/ci.yml`
- `scripts/release-target-resolution.ts`
- `release-please-config.json`
- `.release-please-manifest.json`
- `docs/releases.md`
- `CHANGELOG.md`
- `.github/workflows/release-verify.yml`
- `docs/runbooks/release-and-self-upgrade-debugging.md`
- `openspec/changes/archive/qtx-0030-adopt-release-please-release-pr-flow/proposal.md`
