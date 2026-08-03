## Context

Quantex currently uses one manually dispatched workflow to infer whether a protected branch needs a Release PR, npm publication, GitHub Release creation, or no action. That inference walks successful CI history and combines mutable branch state with npm and tag state. The release build is repeated inside publication, and npm can become public before GitHub assets are durably staged. Separately, pre-merge governance exempts trusted release-bot commits even though protected-branch CI rejects the co-author trailers GitHub may synthesize from that topology.

The redesign must preserve release-please for version and changelog preparation, GitHub Actions trusted publishing, `main` and `beta` channels, standalone binaries, and retryability. It cannot provide a real transaction across GitHub and npm, so recovery boundaries must be explicit and idempotent.

## Goals / Non-Goals

**Goals:**

- Separate mutable Release PR preparation from immutable release sealing and publication.
- Make an exact tag and commit SHA the only publication identity.
- Build and validate one release candidate, then publish those exact bytes.
- Align pre-merge and protected-branch commit-message governance.
- Recover safely when a tag, draft release, assets, or npm version already exists.

**Non-Goals:**

- Automatically merge Release PRs or bypass protected-branch review.
- Make GitHub Release and npm publication globally atomic.
- Publish or synchronize the separate `quantex` npm package.
- Redesign ordinary CI artifacts or introduce a workflow orchestration layer.

## Decisions

### Split release preparation, sealing, and publication

`prepare-release.yml` will only create or update a release-please PR for an allowlisted protected branch. `seal-release.yml` will inspect the current protected-branch head, require successful push CI for that exact SHA, validate the release commit and package version, create or verify the immutable version tag, and explicitly dispatch `release.yml` at that tag. `release.yml` will accept only a tag ref and will never infer a candidate from branch history.

This is preferred over extending the current resolver because preparation is branch-oriented while publication is artifact-oriented. Keeping them in one state machine makes retries dependent on unrelated newer history.

### Treat tag creation as sealing, not publication discovery

The tag name, root package version, release commit title, target branch, npm channel, tagged SHA, and successful CI SHA must agree before publication mutates external state. Stable tags must point to `main`; prerelease tags must point to `beta`. A pre-existing tag is accepted only when it points to the same validated SHA.

The sealing workflow explicitly dispatches the publish workflow because tags created with `GITHUB_TOKEN` do not reliably trigger another workflow. Keeping the tag push trigger also supports a maintainer-created tag, but the same validation applies.

### Promote one release-candidate artifact

The build job checks out the exact tag, runs repository validation, builds the runtime and standalone binaries, produces release metadata and checksums, creates the npm tarball, and uploads one immutable Actions artifact named for the tag and run attempt. The publish job downloads that artifact and has no source checkout or build step.

This is preferred over rebuilding in the publish job because validation must cover the bytes that reach npm and GitHub Releases.

### Stage GitHub assets before npm and publish the release last

Publication creates or recovers a draft GitHub Release, reconciles and verifies its expected assets, checks whether the exact npm version already exists, publishes the exact tarball when absent, verifies registry closure, and only then makes the GitHub Release public. If npm is already public, its tarball integrity must match the candidate before continuing.

This ordering cannot roll back npm, but it prevents a newly public npm version from being the first mutation and leaves a recoverable draft when later steps fail.

### Remove the trusted release-bot commit exemption

A generated Release PR must contain one maintainer-authored commit before merge. The same no-`Co-authored-by` rule applies before and after merge. Rebase remains preferred; squash is allowed only after re-authoring produces a safe single-commit topology.

This is preferred over teaching protected-branch CI to trust bot trailers because the repository policy intentionally rejects co-author trailers in release history.

## Risks / Trade-offs

- [A tag can be created before publication succeeds] -> Publication is tag-idempotent and can be explicitly redispatched at the same tag.
- [npm and GitHub cannot commit atomically] -> Verify draft assets first, publish the exact tarball second, publish the GitHub Release last, and reconcile existing state on retry.
- [Actions artifacts expire] -> A retry can rebuild only when the prior build artifact is unavailable, but it must reproduce and verify the immutable tag candidate before mutation.
- [Maintainers perform one extra sealing action] -> Document the sequence and keep each workflow single-purpose with narrow permissions.
- [Already-published npm bytes cannot be replaced] -> Compare registry integrity with the candidate and fail closed on mismatch.

## Migration Plan

1. Land the OpenSpec delta, split workflows, validation scripts, tests, and release documentation in one process-only PR.
2. Keep release-please manifests and protected branches unchanged.
3. Use the next Release PR to exercise maintainer re-authoring and the new seal workflow.
4. If sealing fails before tag creation, fix and rerun it. If it fails after tag creation, do not move the tag; rerun publication at the same tag.
5. Roll back only by reverting the workflow change before a new tag is sealed. Never move or delete a published version tag as rollback.

## Open Questions

None. The first real release will provide operational evidence for artifact retention and retry ergonomics; changes to those values remain follow-up governance work.
