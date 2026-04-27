## Context

OpenSpec changes in Quantex have two distinct lifecycle moments:

- implementation merged into a protected branch
- change archived after its spec delta is synced into `openspec/specs/`

The current docs mention archive as a follow-up step, but nothing enforces it. That gap let a merged and released change remain active in `openspec/changes/`, which weakens the trustworthiness of project memory.

## Goals / Non-Goals

**Goals:**

- Make archive closure explicit in the workflow contract.
- Reduce reliance on human memory by creating archive follow-up PRs automatically.
- Preserve PR review and branch protection instead of archiving directly on `main`.

**Non-Goals:**

- Archive a change directly on protected branches without review.
- Expand Quantex's user-facing product scope.
- Replace OpenSpec with repo-local workflow orchestration.

## Decisions

- Add a post-merge workflow that scans active changes for `status: complete`.
  - Alternative considered: fail implementation PRs until the same PR archives the change. Rejected because Quantex intentionally archives after merge on protected branches.
- Archive into a dedicated follow-up PR instead of pushing directly to `main` or `beta`.
  - Alternative considered: direct bot commits on protected branches. Rejected because it bypasses the same review and CI guardrails used elsewhere.
- Enable auto-merge on the archive PR after creation.
  - Alternative considered: only open a reminder issue or manual PR. Rejected because that still leaves a memory gap dependent on someone remembering to finish the closure step.
- Keep the automation branch stable per base branch.
  - Alternative considered: create a fresh random branch each run. Rejected because a stable branch makes updates idempotent when more than one completed change accumulates.

## Risks / Trade-offs

- Archive automation could open noisy PRs if OpenSpec marks a change complete too early -> Mitigation: only act on complete changes already present on protected branches after merge.
- Archive PR creation introduces another automation path with GitHub token and body requirements -> Mitigation: reuse the existing GitHub App release identity and generate PR bodies that satisfy governance checks.
- Multiple completed changes may be archived together -> Mitigation: generate a summary from the actual archived change names and keep the PR purpose narrowly scoped to archive closure.
