## Context

The PR merge commit policy relies on commit metadata collected by GitHub Actions. The first version accepted an empty commit list, which would make a missing `PR_COMMITS_JSON` input pass silently and skip the squash co-author trailer risk check.

## Goals / Non-Goals

**Goals:**

- Fail closed when PR commit metadata is unavailable.
- Keep the remediation message actionable for workflow wiring failures.
- Preserve existing checks for direct trailers, multi-commit PRs, and known risky authors.

**Non-Goals:**

- Changing how GitHub API commit metadata is collected.
- Relaxing the no-`Co-authored-by` trailer policy.
- Rewriting any existing `main` history.

## Decisions

- Return a policy error when `commits.length === 0`.
- Stop further validation after the empty-input error because there is no metadata to inspect.
- Add a focused unit test so this failure mode cannot regress silently.

## Risks / Trade-offs

- [Transient GitHub API issue blocks PR Governance] If commit metadata cannot be collected, the PR fails. Mitigation: this is intentional fail-closed behavior for a merge gate.

## Migration Plan

- Update the validator and tests.
- Sync release-governance spec and change artifacts.
- Validate with lint, format, typecheck, tests, OpenSpec validation, and memory checks.

## Open Questions

- None.
