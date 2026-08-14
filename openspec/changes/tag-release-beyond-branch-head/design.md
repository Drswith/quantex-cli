## Context

`runReleaseTagging` reads three facts and derives everything from them:

```ts
const branchHeadSha = await git(['rev-parse', `origin/${branch}`])
const commitTitle = await git(['log', '-1', '--pretty=%s', branchHeadSha])
const packageVersion = packageJson.version ?? ''
```

`findNonReleaseHeadReason` then requires `parseReleaseVersionFromTitle(commitTitle) === packageVersion`, and everything downstream — the CI wait, the tag — uses `branchHeadSha`.

That coupling is the bug. `package.json` is the authority for *which version* is being released, and it stays correct however many commits land afterward. The branch head is only ever a guess at *where* that version's release commit is, and it is wrong the moment anything else merges.

### Why the head check exists

The comment is explicit: the check is a cheap gate in front of an expensive one.

> Decides from the branch head alone, without any network call, whether tagging could apply at all. The runner checks this before waiting on CI: the wait can last 15 minutes, and spending it on an ordinary push that can never be tagged also blocks the next release-please run behind a non-cancelling group.

So any fix must preserve a cheap negative answer for ordinary pushes. Simply deleting the head check would make every push after a release search history, find the release commit, and wait 15 minutes for CI that already passed.

### Why it strands rather than retries

`tag-release` runs on every protected-branch push, so there are plenty of later chances to recover — but each one re-asks the same head question and gets the same answer. The retry loop exists; the predicate is what makes it useless.

## Goals / Non-Goals

**Goals**

- A release commit that is no longer the branch head still gets tagged.
- A later ordinary push recovers a stranded release without human action.
- Ordinary pushes still answer "nothing to do" without a network call or a CI wait.
- Nothing gets tagged that lacks successful protected-branch push CI.

**Non-Goals**

- Serializing merges, or a merge queue.
- Relaxing the exact `chore: release <version>` title match.
- Changing what `release.yml` validates once a tag exists.

## Decisions

### Locate the release commit; do not assume it is the head

`package.json` names the version. Find its commit:

```ts
const releaseSha = await findReleaseCommitSha({ branch, version: packageVersion, depth: RELEASE_SEARCH_DEPTH })
```

implemented as a bounded first-parent walk of `origin/<branch>`, matching the commit whose title parses to exactly `packageVersion`. `--first-parent` keeps the walk on the protected branch's own history rather than descending into merged side branches, which is the same history the release contract reasons about.

The match is unique in practice: `package.json`'s version advances only at release commits, so at most one commit on the branch carries `chore: release <packageVersion>`. Taking the most recent match is well-defined even if a version were somehow re-released.

### Bound the search

`RELEASE_SEARCH_DEPTH = 200` first-parent commits. The release commit for the *current* manifest version is always recent — anything older means the version was released long ago and is already tagged, which the tag check settles first. The bound is a safety net against an unbounded walk on a repository with a corrupted or hand-edited manifest, not a tuning knob.

### Reorder: tag check before CI wait

Today the order is `readTagSha` → `waitForSuccessfulCi` → `resolveReleaseTagPlan`, so even a `relabel-only` outcome pays the full wait. That was tolerable only because the head check filtered out almost everything first.

Once the head check is gone, ordinary pushes reach this code, so the order has to change:

1. Resolve the release commit from local history. No release commit found → `noop`, no network.
2. Read the tag. Tag already at the resolved commit → `relabel-only`, no CI wait.
3. Tag exists elsewhere → throw, unchanged.
4. Otherwise wait for CI **on the resolved commit**, then tag it.

The common case — a push after the release was already tagged — now settles at step 2 with one local `git rev-list`, which is cheaper than today's path, not more expensive. `findSuccessfulProtectedBranchCiSha` already queries by exact `head_sha`, so pointing it at the release commit needs no change.

### What still fails closed

- No commit in the window matches the manifest version → `noop`. A version can never be tagged onto an unrelated commit.
- The tag exists at a different sha → throw. Unchanged, and still the guard behind "never move a version tag to recover publication."
- CI has not succeeded on the resolved release commit → throw. The check simply follows the commit it now correctly identifies.

`release.yml`'s seal contract is unaffected: it independently re-validates that the tagged commit's title is exactly `chore: release <version>`, that `tagSha === commitSha`, and that the commit is on `main`. This change makes `tag-release` find the same commit that contract would accept.

### Alternatives rejected

- **Trigger tagging from the Release PR merge event instead of the push.** A merge event is not proof the commit reached the protected branch, and it drops the retry-on-later-push property that makes recovery automatic.
- **Serialize merges behind a queue.** Solves the race by forbidding it, at a cost to every unrelated PR, and still leaves the job unable to recover an already-stranded release.
- **Scan for any untagged `chore: release *` commit.** Drops `package.json` as the version authority and could tag a version the manifest has already moved past.
- **Keep the head check and add a separate recovery workflow.** Two code paths for one decision, and the recovery path would need its own trigger and its own guards.

## Risks / Trade-offs

- **A push now does a `git log` walk it previously skipped.** Bounded to 200 first-parent commits on an already-fetched branch; immaterial against a job that otherwise waits minutes on CI.
- **Recovery is not instant.** A stranded release stays stranded until the *next* push to `main`. Acceptable: it converts a permanent stall needing a hand-pushed tag into a self-correcting one. Recovering immediately would require a scheduled trigger, which is out of scope here.
- **A hand-edited `package.json` version with no matching release commit yields `noop`.** That is the intended fail-closed behavior, and it matches today's outcome for the same input.

## Migration Plan

None. No schema, workflow, flag, or persisted format changes. `v1.9.3` was already recovered manually; the first push to `main` after this merges exercises the new path with the tag already present, which is the `relabel-only` case.

## Open Questions

None.
