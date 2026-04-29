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
- archived OpenSpec change history

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
8. Treat "implementation merged" and "OpenSpec archived" as separate closure steps; a non-trivial change is not fully done until a Superpowers/Quantex-runtime archive follow-up reaches PR or merge delivery.

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

## Release under protected `main`

Quantex uses release-please to keep publishing compatible with protected `main` and source-visible versions.

1. Merge one or more normal change PRs to `main`.
2. The merge-gating `CI` workflow runs on the resulting `main` push. Product-impacting changes keep the normal cross-platform test matrix; process-only changes may skip the expensive platform jobs while still publishing the same required check contexts.
3. After that `main` CI run completes successfully, the `Release` workflow runs release-please for the exact merged SHA.
4. If the merged commits warrant a version bump, release-please creates or updates a Release PR.
5. The Release PR updates `CHANGELOG.md`, `package.json`, `.release-please-manifest.json`, and `src/generated/build-meta.ts`.
6. `Release PR Automerge` validates the generated Release PR and enables auto-merge.
7. After the Release PR merge produces another successful `main` CI run, the `Release` workflow creates the tag and GitHub Release, then builds artifacts, publishes npm through trusted publishing, and uploads binaries.

This keeps normal product changes behind PR review while making the release version visible in the source tree at the tagged commit.

Release notes are tracked in [CHANGELOG.md](../CHANGELOG.md), summarized in [docs/releases.md](./releases.md), and published on GitHub Releases.

The npm publish step uses GitHub Actions trusted publishing with OIDC rather than a long-lived `NPM_TOKEN`, so npm trusted publisher settings should point at `.github/workflows/release.yml`.

For full unattended publishing, configure the release GitHub App secrets `RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`. The workflows use `actions/create-github-app-token` to mint short-lived installation tokens for Release PR creation, Release PR auto-merge, GitHub Release creation, and artifact upload.

Avoid using `GITHUB_TOKEN` as the normal release identity because GitHub suppresses many workflow events created by `GITHUB_TOKEN`, which can leave generated Release PR checks in `action_required`.

Release PR creation relies on merged commit metadata. In practice that means:

- `feat:` commits produce a minor release
- `fix:` and `perf:` commits produce a patch release
- `BREAKING CHANGE:` or `!` produces a major release
- `docs:`, `test:`, `ci:`, and `chore:` do not create a release unless the commit metadata is explicitly changed to do so later

For PRs that only touch workflow, documentation, project-memory, or release-please configuration files, use `ci:`, `chore:`, or `docs:` titles. PR Governance blocks release-worthy metadata for those scopes so release-process changes do not accidentally create stable product Release PRs.

Protected-branch release automation now keys off successful push-side CI completion rather than racing the raw `push` event. A failed `main` or `beta` CI run therefore blocks automated Release PR creation and publication until the branch is green again.

The stable release-please config may include a temporary `last-release-sha` anchor after release-governance incidents. Treat it as a recovery boundary, not a permanent release policy; remove or advance it after the next intentional stable release lands.

## Repository assets

The repository now includes:

- issue forms in `.github/ISSUE_TEMPLATE/`
- a PR template in `.github/pull_request_template.md`
- a PR body validation workflow in `.github/workflows/pr-governance.yml`
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

## Agent Runtime

For non-trivial behavior or durable-process changes, use Superpowers plus the central Quantex runtime skill rather than ad hoc planning files or copied per-agent workflow prompts:

- `skills/quantex-agent-runtime/SKILL.md`: Quantex-specific session startup, intake, validation, artifact routing, and closure
- Superpowers skills: brainstorming, worktrees, planning, review, verification, and finishing branch behavior
- OpenSpec CLI: proposal, design, spec, task, status, instructions, validation, and archive state transitions
- [Quantex Task Start](./runbooks/quantex-task-start.md): copy-paste start prompt for fresh agent conversations when a native slash or skill launcher is unavailable

On protected branches, archive closure is an explicit agent-driven follow-up. A fresh agent session should be able to resume from Superpowers + `skills/quantex-agent-runtime/SKILL.md`, inspect active OpenSpec changes, archive completed work, validate, and deliver the archive PR.

Agents should use `openspec status --change <id> --json` and `openspec instructions <artifact> --change <id> --json` when they need to determine the next artifact or implementation step.

Before final handoff, agents should also check `git status`, whether the branch has been pushed, whether a PR exists, whether the OpenSpec change is still active by design, and whether archive or release closure is pending.

## Discussion promotion rules

Do not let a merged PR depend only on a GitHub discussion for its rationale.

Promote discussion outcomes like this:

- decision that lasts beyond the current change -> ADR
- non-trivial behavior change -> OpenSpec
- future executable work -> GitHub issue; use OpenSpec too when it changes behavior or durable process
- reusable debugging or recovery knowledge -> runbook
- session-specific context -> session summary
