## Context

The Release workflow currently runs release-please on every push to `main` and `beta`. release-please normally decides whether a release is needed, but it can still fail before reaching a no-op result because it must query GitHub release and commit history.

## Goals / Non-Goals

**Goals:**

- Avoid release-please API calls for pushes that cannot produce a release.
- Preserve normal stable and beta release behavior for release-worthy commits and release PR merges.
- Keep manual dispatch as an escape hatch that always runs release-please.

**Non-Goals:**

- Replace release-please.
- Change versioning, trusted publishing, artifacts, or release PR automation.
- Infer releases from changed file paths.

## Decisions

- Gate release-please on commit metadata rather than changed files.
  Rationale: release-please itself is conventional-commit driven, and PR Governance already protects docs/process-only PRs from release-worthy metadata.
- Treat `chore: release ...` as release-relevant.
  Rationale: release PR merges use chore release commits and must still create tags/releases.
- Keep all build/publish steps behind `release_created`.
  Rationale: the relevance gate only decides whether release-please should run; release-please remains the source of truth for whether a release was created.

## Risks / Trade-offs

- Risk: a malformed release-worthy commit title could skip release-please.
  Mitigation: keep PR Governance responsible for commit metadata and allow manual dispatch to force release-please.
- Risk: multi-commit direct pushes may need broader detection.
  Mitigation: protected branches normally receive squash merges; manual dispatch remains available for exceptional recovery.
