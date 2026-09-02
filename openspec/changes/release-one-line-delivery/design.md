## Context

After a Release PR merges, `release-please.yml` tags the current version and immediately becomes eligible to prepare the next Release PR once the tag exists. Publication happens asynchronously in `release.yml`. Installer smoke currently `needs: [publish, build-candidate]` and downloads from the public release URL, so npm is already immutable when smoke can fail.

Steps 1–3 removed advisory schedules, Windows merge-gating, and human heuristics on Release PRs. Step 4 must make the remaining order fail-closed with the smallest enforceable change.

## Goals / Non-Goals

**Goals:**

- Make it impossible for automation to prepare the next release while the current tag's Release workflow has not succeeded.
- Make it impossible for `release.yml` to publish npm before candidate installer smoke succeeds.
- Keep GitHub Release + npm CLI publish and the existing version line.
- Keep recovery at the same tag (no retagging, no rollback of published npm).

**Non-Goals:**

- Waiting inside `tag-release` for the full Release matrix (too long under a non-cancelling concurrency group).
- Changing installer UX for end users beyond an optional download-base override used by CI.
- Core package publishing, OpenSpec/memory CI lint gates, catalog features.

## Decisions

1. **Extend seal to require Release workflow success, not only the tag.**
   `resolveBranchSealState` gains a `releaseSucceeded` input. A branch with a tag but no successful `release.yml` run for that tag is unsealed. `publishBranchSealState` queries completed `release.yml` runs for the tip manifest tag (same tip-based read as today's tag check). Alternatives considered: only ordering tag-before-prepare (already shipped; insufficient), or waiting for Release inside `tag-release` (holds concurrency for the full publish matrix).

2. **Resume preparation via `workflow_run` on successful `Release`.**
   `release-please.yml` also triggers when `Release` completes. On success, `tag-release` publishes sealed=true and release-please prepares the next PR without needing an unrelated main push. Failed Release runs leave the branch unsealed and skip preparation. Alternatives considered: polling from `tag-release` (long lock), or relying solely on the next human/agent push (leaves a silent gap after green releases).

3. **Candidate installer smoke before npm, using the artifact bytes that will be published.**
   `verify-installers` depends only on `build-candidate`. Each leg downloads the release-candidate artifact, serves `release-candidate/assets` over localhost, and runs the tagged installer with `QUANTEX_DOWNLOAD_BASE` pointing at that server. `publish` then `needs: [build-candidate, verify-installers]`. Draft GitHub Release creation, asset upload, npm publish, and undraft stay in `publish` after smoke. Alternatives considered: smoke against a draft GitHub Release (draft assets are not anonymously downloadable), or a non-installer binary extract check (would not exercise the documented installers).

4. **Add `QUANTEX_DOWNLOAD_BASE` to `install.sh` / `install.ps1`.**
   When set, installers fetch the archive and `SHA256SUMS.txt` from that base instead of GitHub release URLs. Default behavior for users is unchanged. This is release-verification surface, not a product feature.

5. **Keep same-tag recovery and immutable npm semantics.**
   A smoke failure fails the workflow before npm publish. A publish failure after smoke still uses same-tag rerun; never move tags.

## Risks / Trade-offs

- [Risk] Release Please stays quiet until Release succeeds or another push arrives → Mitigation: `workflow_run` on successful Release; runbook documents the sealed=tag+Release-success meaning.
- [Risk] Localhost asset server flakes on a runner → Mitigation: fail that matrix leg; `fail-fast: false` still reports all platforms; same-tag rerun after remediation.
- [Risk] Seal query misses a successful run due to API pagination/filtering → Mitigation: filter `release.yml` runs by tag as `branch`, require `conclusion=success`, fail closed (unsealed) rather than false sealed.
- [Risk] `QUANTEX_DOWNLOAD_BASE` is misused to point at untrusted hosts → Mitigation: undocumented except in release CI/runbook; default path remains GitHub releases.

## Migration Plan

1. Land OpenSpec + workflow/script/docs/tests on a feature branch and PR.
2. Next Release PR merge: tag → Release builds candidate → installer smoke on candidate → npm/GitHub publish → workflow_run resumes Release Please on sealed tip.
3. If smoke fails, fix and rerun `Release` at the same tag; npm never saw the bad candidate.
4. Archive the OpenSpec change after merge and post-merge verification.

## Open Questions

None. Dual Core publish freeze and OpenSpec/memory lint gates remain steps 5–6.
