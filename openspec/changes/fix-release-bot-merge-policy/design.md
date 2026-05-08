## Context

Quantex uses two governance lanes for pull requests:

- `PR Governance` runs on every pull request and validates body requirements plus squash-merge safety.
- `Release PR Automerge` runs on `pull_request_target` for release-please branches and validates release-specific scope before enabling auto-merge.

Today these lanes disagree. `Release PR Automerge` trusts the repository GitHub App release bot and merges the release PR, while `PR Governance` rejects the same PR because its single generated commit uses a bot noreply identity that matches the generic risky-author blocklist.

At the same time, `PR body` governance currently exempts any branch whose name starts with `release-please--branches--`, which is broader than the actual trusted release flow.

## Goals / Non-Goals

**Goals:**

- Make release PR trust decisions come from one explicit validation path.
- Allow the repository release bot identity only when the pull request is a validated release PR.
- Keep generic bot-author and multi-commit squash protections unchanged for ordinary PRs.

**Non-Goals:**

- Changing release-please file scope, title, or version semantics.
- Relaxing co-author trailer protections for non-release PRs.
- Stabilizing the separate post-merge `self-managed` sandbox failures.

## Decisions

### Reuse the shared release PR validator inside PR Governance

`PR Governance` will run `scripts/release-pr-policy.js` for branches that claim to be release-please branches. This makes release exceptions depend on the same branch, body marker, file scope, and version progression rules already used by release automation.

Alternative considered: allow the release bot identity directly inside `pr-merge-commit-policy.ts`. Rejected because a bot allowlist without release PR validation would let branch naming or author spoofing bypass unrelated governance checks.

### Propagate a validated release PR flag into local governance scripts

After `PR Governance` validates a release PR, it will pass `PR_IS_VALIDATED_RELEASE_PR=true` into both local governance scripts. The scripts remain locally executable and do not need to embed GitHub API logic.

Alternative considered: duplicate release PR validation logic in `pr-body-policy.ts` and `pr-merge-commit-policy.ts`. Rejected because it would fragment policy and drift from release automation.

### Keep the bot exemption exact and narrow

`pr-merge-commit-policy.ts` will continue to block generic bot noreply authors. It will exempt only the exact repository release bot identity, and only when `validatedReleasePr` is true. Direct `Co-authored-by:` trailers and multi-commit PRs remain failures.

## Risks / Trade-offs

- [Risk] `PR Governance` becomes slightly more complex because it now evaluates release PR shape before body/merge checks. → Mitigation: reuse the existing shared validator and pass only a boolean into downstream scripts.
- [Risk] The repository release bot identity could change in the future. → Mitigation: keep the trusted identity centralized in one helper and cover it with unit tests so drift is obvious.
- [Risk] A broken release PR now fails earlier in `PR Governance` instead of only in release auto-merge. → Mitigation: this is intentional; it surfaces invalid release PRs before merge gates disagree.

## Migration Plan

1. Add the release PR validation step and base-version lookup to `PR Governance`.
2. Gate release-specific body and merge-policy exceptions on the validated release PR flag.
3. Add unit and workflow contract tests for the new signal.

No data migration or rollback tooling is required. If rollback is needed, the workflow and script changes can be reverted together.

## Open Questions

- None.
