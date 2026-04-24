# GitHub Collaboration Flow

This document describes the GitHub-side workflow that sits on top of Quantex's repo-native project memory system.

## Intent

GitHub is not the source of truth for long-lived project knowledge. It is the collaboration surface that helps route discussion into durable repo artifacts.

Use GitHub for:

- open-ended discussion
- issue intake
- pull-request review
- merge gating

Use the repository for:

- specs
- ADRs
- runbooks
- session summaries
- autonomy task contracts

## Recommended flow

1. Start exploratory conversations in GitHub Discussions.
2. Summarize the conclusion in `docs/sessions/` if the discussion materially changes direction.
3. Open or update a GitHub issue for the actionable work.
4. Create or update:
   - `autonomy/tasks/` for executable work
   - `docs/adr/` for durable decisions
   - `openspec/` for non-trivial behavior changes
5. Create a dedicated worktree-backed branch and open a PR.
6. Merge only after CI, PR governance, and documentation updates are in place.
7. Mark the task done and update any affected runbooks, specs, or ADRs.

## Worktree-backed task execution

For implementation that is expected to create commits or a PR, Quantex defaults to a dedicated git worktree rather than switching the user's active workspace in place.

Use `bun run worktree:new -- --task qtx-0000 --title "Task title"` to scaffold a new task worktree.

Worktrees are required when:

- the current workspace already has local changes
- more than one task may be active in parallel
- the user wants their IDE to stay on its current branch or context
- the task may touch `main`, `beta`, or automation-managed release branches during verification

Working directly in the current workspace is reserved for:

- read-only inspection
- short-lived commands that do not create commits
- explicit in-place edits requested by the user

Preferred naming:

- branch: `codex/<task-or-title-slug>`
- worktree path: `../<repo-name>-<task-or-title-slug>`

Clean up merged or abandoned worktrees with `git worktree remove <path>` and `git worktree prune` after confirming no unmerged commits remain.

## Release under protected `main`

Quantex uses release-please to keep publishing compatible with protected `main` and source-visible versions.

1. Merge one or more normal task PRs to `main`.
2. The `Release` workflow runs release-please on the resulting `main` push.
3. If the merged commits warrant a version bump, release-please creates or updates a Release PR.
4. The Release PR updates `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`.
5. `Release PR Automerge` validates the generated Release PR and enables auto-merge.
6. The `Release` workflow creates the tag and GitHub Release, then builds artifacts, publishes npm through trusted publishing, and uploads binaries.

This keeps normal product changes behind PR review while making the release version visible in the source tree at the tagged commit.

Release notes are tracked in [CHANGELOG.md](../CHANGELOG.md), summarized in [docs/releases.md](./releases.md), and published on GitHub Releases.

The npm publish step uses GitHub Actions trusted publishing with OIDC rather than a long-lived `NPM_TOKEN`, so npm trusted publisher settings should point at `.github/workflows/release.yml`.

For full unattended publishing, configure `RELEASE_PLEASE_TOKEN` and `RELEASE_AUTOMERGE_TOKEN` as dedicated release bot or GitHub App tokens. The workflows can fall back to `GITHUB_TOKEN`, but that fallback may leave generated Release PR checks in `action_required` because GitHub suppresses many workflow events created by `GITHUB_TOKEN`.

Release PR creation relies on merged commit metadata. In practice that means:

- `feat:` commits produce a minor release
- `fix:` and `perf:` commits produce a patch release
- `BREAKING CHANGE:` or `!` produces a major release
- `docs:`, `test:`, `ci:`, and `chore:` do not create a release unless the commit metadata is explicitly changed to do so later

For PRs that only touch workflow, documentation, project-memory, or release-please configuration files, use `ci:`, `chore:`, or `docs:` titles. PR Governance blocks release-worthy metadata for those scopes so release-process changes do not accidentally create stable product Release PRs.

The stable release-please config may include a temporary `last-release-sha` anchor after release-governance incidents. Treat it as a recovery boundary, not a permanent release policy; remove or advance it after the next intentional stable release lands.

## Repository assets

The repository now includes:

- issue forms in `.github/ISSUE_TEMPLATE/`
- a PR template in `.github/pull_request_template.md`
- discussion forms in `.github/DISCUSSION_TEMPLATE/`
- a PR body validation workflow in `.github/workflows/pr-governance.yml`

## Manual GitHub setup still required

Some GitHub features are controlled in the repository settings UI and cannot be fully created from versioned files alone.

### Enable Discussions

Enable GitHub Discussions for the repository. GitHub supports structured discussion forms via `/.github/DISCUSSION_TEMPLATE/`, but those forms only apply once Discussions is enabled and matching categories exist.

Suggested categories and slugs:

- `Ideas` with slug `ideas`
- `Decisions` with slug `decisions`
- `Workflow` with slug `workflow`

The filenames in `.github/DISCUSSION_TEMPLATE/` already assume those slugs.

### Protect `main`

Configure branch protection or rulesets so that `main` requires:

- the main CI workflow
- the `PR Governance` workflow

### Labels

Create the labels referenced by the forms, or adjust the forms to match your preferred label set.

Suggested labels:

- `kind:feature`
- `kind:bug`
- `kind:docs`
- `source:discussion`

### Milestones

Milestones are optional. If you use them, prefer milestone names that represent product arcs or epics rather than implementation details.

Examples:

- `dual-mode-surface`
- `self-upgrade-hardening`
- `agent-update-unification`

## Discussion promotion rules

Do not let a merged PR depend only on a GitHub discussion for its rationale.

Promote discussion outcomes like this:

- decision that lasts beyond the current change -> ADR
- non-trivial behavior change -> OpenSpec
- future executable work -> autonomy task
- reusable debugging or recovery knowledge -> runbook
- session-specific context -> session summary
