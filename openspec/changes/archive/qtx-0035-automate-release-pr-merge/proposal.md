# qtx-0035: Automate release PR merge

> Migrated from `autonomy/tasks/qtx-0035-automate-release-pr-merge.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | release |
| Depends on | qtx-0030, qtx-0034 |
| Human review | `required` |
| Docs to update | docs/runbooks/releasing-quantex.md, docs/github-collaboration.md |

## Historical Task Contract

# Task: Automate release PR merge

## Goal

Valid release-please Release PRs should merge automatically after scoped validation and required checks, so release-worthy task PRs can flow from merge to publication without manual Release PR merging.

## Context

Release-please solved source-visible versioning, but it reintroduced a manual merge step for Release PRs. The project goal is agent-led iteration where normal task PRs can trigger safe release publication without local release commands or repeated human intervention.

## Constraints

- Only automate release-please generated PRs from same-repository release branches.
- Only support the known stable and beta release branches.
- Validate that Release PRs only modify source-controlled release files before enabling auto-merge.
- Keep npm trusted publishing in `.github/workflows/release.yml`.
- Prefer dedicated bot tokens so release-please generated PRs trigger downstream workflows normally.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/34
- Add `.github/workflows/release-pr-automerge.yml`.
- Validate Release PR repository, branch, base, title, release-please marker, and changed files.
- Enable GitHub auto-merge for valid Release PRs.
- Let branch protection and required checks decide the final merge timing.
- Update Release workflow to prefer `RELEASE_PLEASE_TOKEN` over `GITHUB_TOKEN`.

## Done When

- Valid stable and beta release-please PRs are eligible for auto-merge.
- Invalid Release PRs fail before auto-merge is enabled.
- Release docs explain the required repository settings and bot-token assumptions.

## Verification Notes

- Local validation passed: `bun run memory:check`, `bun run lint`, `bun run typecheck`.
- Release PR automerge validation examples passed for stable, beta, cross-repository, bad-title, unexpected-file, and missing-file cases.
- Repository auto-merge was disabled before this task and must be enabled after the workflow lands.

## Non-Goals

- Publishing releases outside the existing Release workflow.
- Auto-merging arbitrary product PRs.
- Changing version calculation rules.
