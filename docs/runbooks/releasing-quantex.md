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

### 2. Let release-please create or update the Release PR

The `Release` workflow runs from pushes to `main`. release-please reads merged commit metadata and maintains a Release PR when a version bump is warranted.

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

After the Release PR is merged, the release workflow reruns:

- `bun run memory:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

This keeps publish gating inside the workflow that npm trusts for OIDC publishing.

### 5. Publish automatically

When release-please reports that a GitHub Release was created, the workflow:

- builds binaries
- generates release artifacts
- runs `release:smoke`
- publishes to npm
- uploads binaries to the GitHub Release

For regular non-release merges to `main`, the workflow only creates or updates a Release PR and exits cleanly without publishing.

## Version rules

Release PR creation uses conventional commits:

- `feat:` => minor release
- `fix:` => patch release
- `perf:` => patch release
- `BREAKING CHANGE:` footer or `!` => major release
- `docs:`, `test:`, `ci:`, `chore:` => no release unless the metadata is intentionally changed

Release automation, documentation, and project-memory-only PRs must use non-release-worthy titles such as `ci:`, `chore:`, or `docs:`. PR Governance rejects release-worthy titles for PRs that only change `.github/`, `docs/`, `autonomy/`, or release-please configuration files, because those changes should not create stable product releases by themselves.

The stable release-please config currently includes a temporary `last-release-sha` anchor to exclude a historical release-process `feat(release)` commit from stable release calculation. Remove or advance that anchor after the next intentional stable Release PR is merged, because release-please treats `last-release-sha` as an explicit scan boundary until it is changed.

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

Release PRs are created by `github-actions[bot]`. If GitHub marks the generated Release PR checks as `action_required` with no jobs, close and reopen the Release PR from a maintainer account to trigger the required `pull_request` checks.

For the non-interactive release flow, configure a dedicated release bot token or GitHub App token:

- `RELEASE_PLEASE_TOKEN` lets release-please create PRs in a way that triggers downstream workflows normally.
- `RELEASE_AUTOMERGE_TOKEN` lets the automerge workflow enable auto-merge for validated Release PRs.
- Both tokens need enough permission to read PR files and update/merge pull requests.

The workflows fall back to `GITHUB_TOKEN`, but that fallback is best treated as degraded mode because GitHub suppresses many workflow events created by `GITHUB_TOKEN`.

## Validation

The closest local verification path for release artifacts remains:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run build
bun run build:bin
bun run release:artifacts
bun run release:smoke
```

`release:artifacts` must fail if the release manifest is missing any required platform binary:

- `quantex-darwin-arm64`
- `quantex-darwin-x64`
- `quantex-linux-arm64`
- `quantex-linux-x64`
- `quantex-windows-x64.exe`

## Related artifacts

- `.github/workflows/release.yml`
- `.github/workflows/release-pr-automerge.yml`
- `.github/workflows/ci.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `docs/releases.md`
- `CHANGELOG.md`
- `.github/workflows/release-verify.yml`
- `docs/runbooks/release-and-self-upgrade-debugging.md`
- `autonomy/tasks/qtx-0030-adopt-release-please-release-pr-flow.md`
