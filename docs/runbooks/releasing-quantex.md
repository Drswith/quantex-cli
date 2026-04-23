# Runbook: Releasing Quantex With Protected Main

## Purpose

Provide the canonical release procedure now that `main` only accepts changes through pull requests, without bringing back a long list of manual Git commands.

## When to use

- you are preparing a new Quantex release
- you need to cut a prerelease such as `beta`
- you are verifying whether the current release procedure is still compatible with repository protections

## Why the old flow no longer fits

The historical `bun run release` flow used `bumpp` to bump the version, commit, tag, and push in one local step.

That no longer matches repository policy because:

- version bumps must land on `main` through a PR
- the existing publish workflow in `.github/workflows/release.yml` still triggers from a pushed `v*` tag

The release flow now needs two explicit phases:

1. prepare the version bump in a release PR
2. publish by tagging the merged `main` commit

## Canonical flow

### 1. Prepare the release PR

Run a single command from a clean worktree:

```bash
bun run release
```

What `bun run release` now does:

- switches to `main`
- fast-forwards local `main` from `origin/main`
- creates a temporary release branch
- keeps `bumpp`'s interactive version selection
- creates the version bump commit without tagging or pushing
- renames the branch to `codex/release-v<version>`
- pushes the branch to origin
- opens a PR to `main` when GitHub CLI is available and authenticated

For an explicit release type or prerelease, pass flags through to `bumpp`:

```bash
bun run release -- --release patch
bun run release -- --release prerelease --preid beta
```

Then let CI pass and merge the generated release PR into `main`.

### 2. Publish the merged release

Run:

```bash
bun run release:publish
```

What `bun run release:publish` does:

- switches to `main`
- fast-forwards local `main` from `origin/main`
- creates the release tag for `package.json` version
- pushes the tag to origin

What the underlying `release:tag` guard still checks:

- current branch must end up on `main`
- worktree must be clean
- local `main` must match its upstream
- local tag `v<package.json version>` must not already exist

If you want the low-level manual control, these helpers still exist:

```bash
bun run release:tag
git push origin v0.1.2
```

### 3. Let GitHub Actions publish the release

Pushing the tag triggers:

- `.github/workflows/release.yml`

That workflow builds binaries, generates release artifacts, smoke-checks the current runner binary, publishes to npm, and creates the GitHub release.

## Important automation note

Do not assume a workflow that pushes a tag with the repository `GITHUB_TOKEN` will trigger `.github/workflows/release.yml`.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`.

That means the safe default for this repository is:

- prepare the version bump in a PR
- push the final release tag from a human-authenticated local checkout

If Quantex later wants a one-click release button, implement a dedicated publish workflow rather than a tag-pusher workflow that expects a second workflow to fan out from the tag push.

## Validation

Before or after tagging, the closest local verification path is:

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
- `.github/workflows/release-verify.yml`
- `docs/runbooks/release-and-self-upgrade-debugging.md`
- `autonomy/tasks/qtx-0027-make-release-flow-compatible-with-pr-only-main.md`
