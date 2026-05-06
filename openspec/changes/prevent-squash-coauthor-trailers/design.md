## Context

GitHub creates the final squash merge commit after all pull request checks have passed. If GitHub adds `Co-authored-by:` trailers to that generated commit, the existing push-time commit trailer policy detects the violation only after the pull request has already merged.

The repository needs a pre-merge gate that treats unsafe squash-merge inputs as a PR governance failure.

## Goals / Non-Goals

**Goals:**

- Fail pull requests before merge when their commits are likely to produce a squash commit with co-author trailers.
- Keep the protected-branch push trailer policy as a backstop.
- Provide actionable remediation: pre-squash and re-author the PR commits before merge.

**Non-Goals:**

- Rewriting existing `main` history.
- Adding a repo-local PR merge wrapper command.
- Replacing GitHub branch protection or rulesets.

## Decisions

- Add a dedicated `scripts/pr-merge-commit-policy.ts` validator, separate from PR body policy and commit trailer policy.
- Run it from `PR Governance` using pull request commit metadata from the GitHub API.
- Reject PRs with multiple commits because GitHub squash merge can synthesize co-author trailers from multi-commit contributor metadata.
- Reject known agent/bot commit authors whose metadata has already produced generated co-author trailers in squash merge commits.

## Risks / Trade-offs

- [Stricter PR hygiene] Multi-commit implementation PRs must be squashed before merge. Mitigation: the failure explains the exact remediation.
- [Known-author list may need updates] New agent commit identities can appear later. Mitigation: keep push-time trailer validation as a backstop and extend the PR validator when a new identity is observed.

## Migration Plan

- Add the PR merge commit policy validator and tests.
- Wire the validator into `PR Governance`.
- Update release governance spec requirements.
- Validate with lint, format, typecheck, tests, OpenSpec validation, and memory checks.

## Open Questions

- None.
