## Context

`quantex-cli@0.29.1` is the published stable version and the lifecycle redesign has completed promotion, release verification, teardown, current-spec synchronization, and archive closure. The repository already treats `1.0.0` as burned and configures release-please to keep breaking changes on the 0.x line. The new product decision is that no version after `0.29.1` may remain on 0.x and the first post-redesign release is `1.1.0`.

The normal release path must remain protected: a main commit triggers release-please Release PR mode after green CI; the generated Release PR materializes version files; its merge triggers GitHub Release, npm trusted publishing, and binary upload. Manually editing the manifest or publishing outside this path would bypass established review and recovery controls.

## Goals / Non-Goals

**Goals:**

- Make `0.29.1` the final accepted stable 0.x base.
- Permit exactly `0.29.1 -> 1.1.0` and reject other pre-major graduation shapes.
- Use the normal generated Release PR and publication workflows.
- Keep the graduation trigger one-shot and resumable across network or quota interruption.
- Return to ordinary SemVer after `1.1.0`.

**Non-Goals:**

- Reusing or republishing burned version `1.0.0`.
- Rewriting the already published `0.29.1` tag, GitHub Release, or npm package.
- Manually changing `package.json`, the release manifest, changelog, or generated build metadata in the graduation PR.
- Changing package/binary identity, v1 protocol compatibility, lifecycle implementation, or beta release semantics.

## Decisions

### Use the official Release-As commit footer

The graduation implementation commit carries `Release-As: 1.1.0` in its body. release-please officially interprets that footer as an exact next-version request and generates the ordinary Release PR. The override exists only in the merged commit; it is not stored as permanent release configuration.

A permanent `release-as` workflow input was rejected because later reconciliation could repeatedly force the same version. Direct version-file edits were rejected because they imitate a trusted generated Release PR and bypass the existing release source of truth.

### Guard the transition in Release PR policy

Stable Release PR policy accepts a major transition from a 0.x base only when the base is exactly `0.29.1` and the proposed version is exactly `1.1.0`. While the base remains `0.29.1`, later 0.x proposals are rejected. `1.0.0` remains independently rejected as burned. Once the base is `1.1.0` or newer, normal version comparison and SemVer release planning apply.

### End pre-major release-please planning

The stable release-please config sets `bump-minor-pre-major` to `false` because the repository is deliberately leaving the zero-major line. The exact first version still comes from `Release-As: 1.1.0`, which avoids release-please selecting burned `1.0.0`. After publication, the setting is inert for a 1.x base and documents the graduated state.

### Keep release delivery manual and rebase-first

The graduation implementation PR uses the exact release-worthy subject `feat(release)!: graduate post-redesign line`, ensuring the repository resolver reaches release-please after green main CI. The exact generated `chore: release 1.1.0` PR from base version `0.29.1` is validated normally, but the Release PR workflow skips bot-token creation and auto-merge enablement before any merge request can be queued. The operator locks the approved head SHA and uses manual rebase merge first, squash only if rebase is unavailable or unsafe. Publication closure is reported only after GitHub Release, npm `latest`, tag, package version, and binary assets all agree on `1.1.0`.

## Risks / Trade-offs

- [The footer is lost or the resolver skips the commit] -> Use the exact tested release-worthy subject plus one footer-bearing implementation commit, rebase merge, and verify the merged main commit body before expecting the Release PR.
- [release-please proposes `1.0.0` or a later 0.x version] -> Stable Release PR policy rejects both and focused tests cover every boundary.
- [Automation creates an unexpected version] -> Do not merge the generated Release PR unless its title and version files are exactly `1.1.0`.
- [Release bot races manual delivery] -> The workflow skips token creation and auto-merge enablement for the exact graduation PR before any auto-merge request exists; verify `autoMergeRequest` is null before manual rebase merge.
- [Publication partially succeeds] -> Reuse the existing resolver's tag/npm recovery path and never publish an older missing package automatically.

## Migration Plan

1. Add focused policy/config regressions and implement the exact graduation guard.
2. Update the release spec and operator documentation, then validate the complete process-only diff.
3. Commit once with `Release-As: 1.1.0`, push, and merge the Ready implementation PR manually after checks.
4. Verify release-please creates exactly `chore: release 1.1.0`; disable auto-merge, validate generated files/checks, and manually rebase merge it.
5. Verify main CI, GitHub Release `v1.1.0`, npm `quantex-cli@1.1.0` with `latest`, and all release assets.
6. Synchronize the accepted release-workflow delta and complete agent-driven OpenSpec archive closure in a follow-up PR.

Rollback before the Release PR merge is to stop and correct the policy/footer through another reviewed PR. After `1.1.0` is published, use the normal forward-fix release process; never delete or reuse the version.

## Open Questions

None. The final 0.x version, first post-redesign version, one-shot trigger, merge order, and closure evidence are fixed.
