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
5. Implement in a branch and open a PR.
6. Merge only after CI, PR governance, and documentation updates are in place.
7. Mark the task done and update any affected runbooks, specs, or ADRs.

## Release under protected `main`

Quantex uses release-please to keep publishing compatible with protected `main` and source-visible versions.

1. Merge one or more normal task PRs to `main`.
2. The `Release` workflow runs release-please on the resulting `main` push.
3. If the merged commits warrant a version bump, release-please creates or updates a Release PR.
4. The Release PR updates `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`.
5. Merge the Release PR when you are ready to publish.
6. The `Release` workflow creates the tag and GitHub Release, then builds artifacts, publishes npm through trusted publishing, and uploads binaries.

This keeps normal product changes behind PR review while making the release version visible in the source tree at the tagged commit.

Release notes are tracked in [CHANGELOG.md](../CHANGELOG.md), summarized in [docs/releases.md](./releases.md), and published on GitHub Releases.

The npm publish step uses GitHub Actions trusted publishing with OIDC rather than a long-lived `NPM_TOKEN`, so npm trusted publisher settings should point at `.github/workflows/release.yml`.

Release PR creation relies on merged commit metadata. In practice that means:

- `feat:` commits produce a minor release
- `fix:` and `perf:` commits produce a patch release
- `BREAKING CHANGE:` or `!` produces a major release
- `docs:`, `test:`, `ci:`, and `chore:` do not create a release unless the commit metadata is explicitly changed to do so later

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
