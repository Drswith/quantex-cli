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

Release commits follow the same rule as product changes: they must arrive on `main` through a PR.

Use this split flow:

1. Run `bun run release` from a clean worktree to let the helper sync `main`, create the release branch, run `bumpp`, push, and open the PR.
2. Merge the generated release PR.
3. Let the merge-to-main release workflow create the tag and publish automatically.

This keeps version bumps reviewable while removing the need for a post-merge local publish step.

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
