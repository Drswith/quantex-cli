## Context

`.github/workflows/release-please.yml` has two jobs on every push to `main`: `release-please` (the `googleapis/release-please-action` call, `skip-github-release: true`) and `tag-release` (`bun run ci:tag-release`), currently wired `tag-release: needs: release-please`. The concurrency group `release-please-${{ github.ref_name }}` does not cancel in flight, so pushes queue rather than overlap.

Tagging was moved out of release-please deliberately: `scripts/release/tag-release.ts` waits for a successful protected-branch push CI run on the release commit before it creates `v<version>`, which is what makes the tag mean "sealed". The cost of that design is a window in which the manifest names a version that has no tag — and release-please currently runs inside that window, on the very push that opens it.

## Goals / Non-Goals

Goals:

- Release-please never computes a version while the current manifest version is untagged.
- The fix holds for runs whose checkout predates the release commit, which is how the 2026-08-28 incident actually reached release-please.
- Failure to seal fails closed.

Non-Goals:

- Returning tag creation to release-please.
- Changing which commit `tag-release` tags, or the CI-wait contract in front of it.
- Reworking `Release-As` parsing or the `release:verify-release-as` gate.

## Decisions

### Reverse the dependency rather than gate on the commit title

The obvious alternative is to keep the order and skip the `release-please` job when the pushed head is a `chore: release <version>` commit. It is a one-line `if:` and needs no new script.

It is also wrong for the observed incident. The run that first produced the bad PR was triggered by an *ordinary* commit (`docs(openspec): archive superseded agent package detection`), not a release commit — a title-based skip would not have fired. What matters is not what the pushed commit is, but whether the branch release-please is about to read has a resolvable boundary. Reversing the dependency and gating on the seal state expresses that directly.

### Resolve the seal state from the branch tip, not the checkout

`tag-release` reads `package.json` from its own checkout, and that is correct for planning: the job must tag the release commit it was triggered for, not whatever landed since. The action, by contrast, reads config, manifest, and branch head live from the GitHub API — its log shows `Fetching .release-please-manifest.json from branch main` — so the two jobs can legitimately disagree about "the current version".

That disagreement is the incident. Run `33160447643` checked out `3bd2ca8` (manifest `1.11.0`), planned `relabel-only` against the existing `v1.11.0`, and would report itself finished and successful; release-please in the same run then read `main` live, where `1dc2eea` had already landed and the manifest said `1.11.1`, and found no `v1.11.1`. Reversing the jobs alone would not have helped, because the job that ran first was answering a question about a different version.

So the seal state is a separate read, taken after `git fetch --force origin <branch> --tags`, from `origin/<branch>:.release-please-manifest.json`. It answers exactly the question release-please is about to ask, against exactly the ref release-please is about to read.

The residual race — `main` moving between the seal read and the action's own read — narrows the window from minutes to seconds and can only produce a skipped preparation, never a wrong version, because a newly landed release commit leaves its own push run queued behind this one.

### Emit the state from `tag-release` instead of a third job

The seal read needs the same `git fetch` and the same Bun toolchain `tag-release` already sets up, and the knowledge belongs to the sealing job. A `sealed` job output consumed by `needs.tag-release.outputs.sealed` keeps one script, one checkout, and one bun install on the critical path. A separate gate job would duplicate all three to answer a question the sealing job has already fetched the data for.

### Read the manifest, not `package.json`

Both files carry the version and `release-please-config.json` keeps them in step, but `.release-please-manifest.json` is the file release-please itself consults to decide which release tag to look for. Reading the same file removes a class of divergence — a hand-edited or partially-updated release commit — from the gate's correctness.

## Risks / Trade-offs

**A skipped preparation is silent.** When the gate reports unsealed, release-please does not run and the job shows as skipped rather than failed. Mitigation: the script logs the resolved version, the tag it looked for, and the verdict, so the reason is in the sealing job's log; and the condition is self-clearing on the next push.

**Preparation now waits on the CI wait.** On a release-commit push, `release-please` is delayed by however long `tag-release` waits for push CI (up to `RELEASE_TAG_MAX_WAIT_MS`, 15 minutes). This is not new wall time — the two jobs were already serialized in the same run — but the *Release PR* now appears after the wait instead of before it. That ordering is the point: a Release PR prepared before the previous release is sealed is the defect.

**A sealing failure now also blocks preparation.** Previously a `tag-release` failure left the Release PR untouched; now it also skips preparation. This is intended and fails closed: every condition that makes sealing fail also makes the boundary unresolvable.

## Migration Plan

`main` is currently unsealed in the opposite direction — `v1.11.1` exists, so the gate reports sealed as soon as it ships. No backfill, no manifest edit, and no tag manipulation is required. The stale PR [#677](https://github.com/Drswith/quantex-cli/pull/677) is closed separately; it is the artifact of the defect, not state this change depends on.

## Open Questions

None.
