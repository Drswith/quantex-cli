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
- archived OpenSpec change history (git history; not retained in working tree)

## Recommended flow

1. Start exploratory conversations in GitHub Discussions.
2. Summarize the conclusion in `docs/sessions/` if the discussion materially changes direction.
3. Open or update a GitHub issue for the actionable work.
4. Create or update:
   - `openspec/changes/` for non-trivial behavior or durable-process changes
   - `docs/adr/` for durable decisions
5. Create a dedicated branch or worktree-backed branch and open a PR.
6. Merge only after CI, PR governance, and documentation updates are in place.
7. Update any affected runbooks, specs, or ADRs; if an OpenSpec change lands, merge its delta into `openspec/specs/` and archive or close the change.
8. Treat "implementation merged" and "OpenSpec archived" as separate closure steps; a non-trivial change is not fully done until a Quantex-runtime archive follow-up reaches PR or merge delivery.

## Top-level backlog issues

Use a single top-level backlog issue when a workstream needs planning-only triage across many candidates, such as agent-catalog expansion.

- keep the top-level issue as planning and triage only; supported state still lives in repo-native catalog/spec/docs artifacts
- open a dedicated per-agent issue once implementation becomes actionable
- pair that per-agent issue with OpenSpec when catalog behavior, product-facing docs, or durable workflow expectations change
- keep delivered candidates checked in their original triage bucket or a documented delivered section so backlog history stays meaningful

## Delivery closure states

Use explicit closure language when handing work between agents, reviewers, and automation:

- local implementation: files changed and local validation passed
- repository delivery: changes committed and the working tree is clean
- PR delivery: branch pushed and PR opened with linked artifacts and validation status
- merge delivery: PR merged into `main` or another protected target branch
- OpenSpec archive closure: accepted spec deltas synced and completed changes archived
- release closure: release workflow completed when commit metadata warrants a release

Agents should not summarize a task as simply "done" when the current state is only local implementation or PR delivery. If the next step belongs to CI, reviewer approval, release automation, or agent-driven OpenSpec archive closure, name that owner explicitly.

## Pull request body preflight

PR descriptions are part of the delivery contract, not a best-effort summary. Before creating or editing a PR body, agents should:

1. Prepare a body file based on `.github/pull_request_template.md`.
2. Run `bun run pr:body:check -- --body-file <body-file> --title "<title>"`.
3. Use `gh pr create --body-file <body-file>` or `gh pr edit --body-file <body-file>`.

Do not hand-write inline `gh pr create --body "$(cat <<EOF ...)"` payloads. Also do not add a repo-local `pr:create` wrapper only to sequence these steps; keep PR creation on the native GitHub CLI and keep repository code focused on shared validation.

## Worktree-backed implementation

For implementation that is expected to create commits or a PR, Quantex defaults to a dedicated git worktree rather than switching the user's active workspace in place.

Worktrees are required when:

- the current workspace already has local changes
- more than one change may be active in parallel
- the user wants their IDE to stay on its current branch or context
- the change may touch `main`, `beta`, or automation-managed release branches during verification

Working directly in the current workspace is reserved for:

- read-only inspection
- short-lived commands that do not create commits
- explicit in-place edits requested by the user

Preferred naming:

- branch: `<agent>/<issue-or-change-slug>`
- worktree path: `../<repo-name>-<issue-or-change-slug>`

Clean up merged or abandoned worktrees with `git worktree remove <path>` and `git worktree prune` after confirming no unmerged commits remain.

## Release under protected `main` and `beta`

Quantex uses release-please with automatic Release PR creation on push to protected branches.

1. Merge normal change PRs to `main` or `beta` after required CI passes.
2. `release-please.yml` opens or updates the Release PR automatically on push.
3. Review and merge the Release PR manually. It updates `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`.
4. Merging the Release PR creates a version tag; `release.yml` publishes npm and GitHub Release assets on tag push.

Release notes: [CHANGELOG.md](../CHANGELOG.md), [docs/releases.md](./releases.md), GitHub Releases.

npm publish uses GitHub Actions OIDC trusted publishing (`.github/workflows/release.yml`). This repository does not synchronize the separate npm `quantex` package.

Configure `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` for release-please GitHub App mutations.

Release-worthy commit metadata:

- `feat:` → minor; `fix:` / `perf:` → patch; `BREAKING CHANGE:` or `!` → major
- `docs:`, `test:`, `ci:`, `chore:` do not create releases unless metadata is changed

For workflow/docs-only PRs, use `ci:`, `chore:`, or `docs:` titles so PR governance does not treat them as product releases.

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

### Protect `main`

Configure branch protection or rulesets so that `main` and `beta` require:

- `lint`
- `test (ubuntu-latest)`
- `test (windows-latest)`
- `test (macos-latest)`
- `sandbox-tests`

PR governance validation runs inside `ci.yml`; it is not a separate required ruleset context.

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

## Agent Runtime

For non-trivial behavior or durable-process changes, use the central Quantex runtime skill rather than ad hoc planning files or copied per-agent workflow prompts:

- `skills/quantex-agent-runtime/SKILL.md`: Quantex-specific session startup, intake, validation, artifact routing, and closure
- [Cloud Agent Automations](./runbooks/cloud-agent-automations.md): Cursor Cloud role split, prompt baselines, model routing, and audit checklist
- OpenSpec CLI: proposal, design, spec, task, status, instructions, validation, and archive state transitions
- [Quantex Task Start](./runbooks/quantex-task-start.md): copy-paste start prompt for fresh agent conversations when a native slash or skill launcher is unavailable

On protected branches, archive closure is an explicit agent-driven follow-up. A fresh agent session should be able to resume from `skills/quantex-agent-runtime/SKILL.md`, inspect active OpenSpec changes, archive completed work, validate, and deliver the archive PR. For an umbrella change delivered through a protected integration branch, each milestone merge closes only that milestone; archive eligibility begins only after the umbrella completion and promotion conditions are satisfied.

Agents should use `openspec status --change <id> --json` and `openspec instructions <artifact> --change <id> --json` when they need to determine the next artifact or implementation step.

Before final handoff, agents should also check `git status`, whether the branch has been pushed, whether a PR exists, whether the OpenSpec change is still active by design, and whether archive or release closure is pending.

Cursor Cloud Automations are external role specialists. Keep their durable responsibilities and prompt baselines aligned with the runbook, but keep hard enforcement in GitHub Actions and repository validators. CI triage should classify failures before implementation changes; PR Governance should comment and request reviewers without approving; bug finding and OpenSpec archive roles should open PRs only inside their narrow role boundaries.

## Discussion promotion rules

Do not let a merged PR depend only on a GitHub discussion for its rationale.

Promote discussion outcomes like this:

- decision that lasts beyond the current change -> ADR
- non-trivial behavior change -> OpenSpec
- future executable work -> GitHub issue; use OpenSpec too when it changes behavior or durable process
- reusable debugging or recovery knowledge -> runbook
- session-specific context -> session summary
