# Runbook: Releasing Quantex Automatically From Main

## Purpose

Provide the canonical release procedure now that Quantex releases are driven directly from merged commits on `main`.

## When to use

- you need to understand when Quantex will publish automatically
- you need to verify whether a merged PR should create a release
- you need to recover when the automated release workflow did not behave as expected

## Canonical release source

Quantex's canonical changelog lives in [GitHub Releases](https://github.com/Drswith/quantex-cli/releases). The repository does not maintain a rolling `CHANGELOG.md`.

The automated release flow uses merged commit metadata on `main` to decide whether to cut a new version.

## Canonical flow

### 1. Merge normal work to `main`

Normal feature, fix, or maintenance work lands through standard PRs. There is no dedicated release-preparation PR anymore.

### 2. Let CI finish on the merged `main` commit

The `Release` workflow listens for successful completion of the `CI` workflow on `main`.

### 3. Let semantic-release decide whether to publish

The release automation examines merged commit metadata since the last release tag.

Current release rules:

- `feat:` => minor release
- `fix:` => patch release
- `perf:` => patch release
- `BREAKING CHANGE:` footer or `!` => major release
- `docs:`, `test:`, `ci:`, `chore:` => no release

### 4. If release-worthy commits exist, publish automatically

When a release is warranted, `.github/workflows/release.yml` now:

- detects that `package.json` version changed on `main`
- computes the next version
- creates the git tag
- builds binaries
- generates release artifacts
- runs `release:smoke`
- publishes to npm
- creates or updates the GitHub release

For regular non-release merges to `main`, the workflow exits cleanly without publishing anything.

## Important automation note

Do not assume a workflow that pushes a tag with the repository `GITHUB_TOKEN` should trigger a second publish workflow.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`.

That is why Quantex now runs version calculation, tagging, npm publish, and GitHub Release creation inside the same release workflow.

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

## Related artifacts

- `.github/workflows/release.yml`
- `release.config.mjs`
- `docs/releases.md`
- `.github/workflows/release-verify.yml`
- `docs/runbooks/release-and-self-upgrade-debugging.md`
- `autonomy/tasks/qtx-0028-replace-bumpp-with-merge-to-main-auto-release.md`
