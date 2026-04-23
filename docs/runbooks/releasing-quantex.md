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
2. let GitHub Actions publish automatically after that PR is merged

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

### 2. Let GitHub Actions publish after merge

Once the release PR lands on `main`, `.github/workflows/release.yml` now does the rest automatically.

What the workflow does on a merged release PR:

- detects that `package.json` version changed on `main`
- creates and pushes `v<version>` for the merged commit
- builds binaries
- generates release artifacts
- runs `release:smoke`
- publishes to npm
- creates or updates the GitHub release

For regular non-release merges to `main`, the workflow exits without publishing anything.

### 3. Manual fallback

The low-level `release:tag` helper still exists for recovery or exceptional cases:

```bash
bun run release:tag -- --push
```

Use that only if the automated release workflow cannot be used and you intentionally need a manual fallback.

## Important automation note

Do not assume a workflow that pushes a tag with the repository `GITHUB_TOKEN` should trigger a second publish workflow.

GitHub's documented behavior is that events created by `GITHUB_TOKEN` do not start another workflow run, except for `workflow_dispatch` and `repository_dispatch`.

That is why Quantex now publishes inside the same merge-to-main workflow that creates the tag, instead of expecting a tag push from `GITHUB_TOKEN` to fan out into another workflow.

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
