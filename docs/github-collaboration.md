# GitHub Collaboration Flow

This document covers the GitHub-side collaboration surface: discussions, issues, PR templates, labels, and repository settings. The workflow process itself (intake, validation, closure states, PR body preflight, worktree rules) lives in `skills/quantex-agent-runtime/SKILL.md`; the release contract lives in `docs/releases.md` and `docs/runbooks/releasing-quantex.md`.

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
- archived OpenSpec change history (git history; not retained in working tree)

## Recommended flow

1. Start exploratory conversations in GitHub Discussions.
2. Summarize the conclusion in `docs/sessions/` if the discussion materially changes direction.
3. Open or update a GitHub issue for the actionable work.
4. Create or update `openspec/changes/` for non-trivial behavior or durable-process changes, and `docs/adr/` for durable decisions.
5. Create a dedicated branch or worktree-backed branch and open a PR (see the runtime skill for the full delivery contract).
6. Merge only after CI, PR governance, and documentation updates are in place.
7. Treat "implementation merged" and "OpenSpec archived" as separate closure steps; archive closure is an agent-driven follow-up.

## Commit authorship

Squash merge can turn commit author metadata into a `Co-authored-by` trailer on `main`, so governance rejects commits authored by an agent or bot identity — for example `cursoragent@cursor.com` or any `...[bot]@users.noreply.github.com` address — as well as any `Co-authored-by:` trailer in a commit message.

Neither is fixable after the fact without rewriting commits, so configure the identity before committing rather than re-authoring later:

```bash
git config user.name "<maintainer name>" && git config user.email "<maintainer email>"
```

Agent-driven sessions must do this in every worktree they commit from; a global setting does not follow a fresh worktree. The `pre-push` hook runs the same check CI runs, so a bad identity or trailer fails locally in about a second instead of after a full CI round trip.

## Top-level backlog issues

Use a single top-level backlog issue when a workstream needs planning-only triage across many candidates, such as agent-catalog expansion.

- keep the top-level issue as planning and triage only; supported state still lives in repo-native catalog/spec/docs artifacts
- open a dedicated per-agent issue once implementation becomes actionable
- pair that per-agent issue with OpenSpec when catalog behavior, product-facing docs, or durable workflow expectations change
- keep delivered candidates checked in their original triage bucket or a documented delivered section so backlog history stays meaningful

## Repository assets

- issue forms in `.github/ISSUE_TEMPLATE/`
- PR template in `.github/pull_request_template.md`
- PR body validation in `.github/workflows/ci.yml` (governance job)
- discussion forms in `.github/DISCUSSION_TEMPLATE/`

## Manual GitHub setup still required

Some GitHub features are controlled in the repository settings UI and cannot be fully created from versioned files alone.

### Enable Discussions

Enable GitHub Discussions for the repository. GitHub supports structured discussion forms via `/.github/DISCUSSION_TEMPLATE/`, but those forms only apply once Discussions is enabled and matching categories exist.

Suggested categories and slugs:

- `Ideas` with slug `ideas`
- `Decisions` with slug `decisions`
- `Workflow` with slug `workflow`

The filenames in `.github/DISCUSSION_TEMPLATE/` already assume those slugs.

### Protect `main` and `beta`

Configure branch protection or rulesets so that `main` and `beta` require exactly the checks that really run on every pull request:

- `lint`
- `governance`
- `test (ubuntu-latest)`
- `test (windows-latest)`
- `test (macos-latest)`

`classify` must not be a required context. `sandbox-tests` is advisory by design and must not be required: fork PRs skip it for lack of secrets, and a skipped required check silently passes without providing coverage.

### Labels

Create the labels referenced by the forms, or adjust the forms to match your preferred label set.

Suggested labels:

- `kind:feature`
- `kind:bug`
- `kind:docs`
- `source:discussion`

### Milestones

Milestones are optional. If you use them, prefer milestone names that represent product arcs or epics rather than implementation details.

## Discussion promotion rules

Do not let a merged PR depend only on a GitHub discussion for its rationale.

Promote discussion outcomes like this:

- decision that lasts beyond the current change -> ADR
- non-trivial behavior change -> OpenSpec
- future executable work -> GitHub issue; use OpenSpec too when it changes behavior or durable process
- reusable debugging or recovery knowledge -> runbook
- session-specific context -> session summary
