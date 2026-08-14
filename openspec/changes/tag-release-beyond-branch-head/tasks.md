## 1. Resolve the release commit from history

- [x] 1.1 Replace `findNonReleaseHeadReason` with a release-commit resolver that reports why tagging cannot apply from the manifest version alone, without a network call.
- [x] 1.2 Add a bounded first-parent history search for the commit whose title is exactly `chore: release <manifest version>`, taking the most recent match.
- [x] 1.3 Change `ReleaseTagInput` to carry the resolved release sha instead of the branch head sha for the tag and CI decisions.
- [x] 1.4 Keep `package.json` as the sole version authority and keep the exact title match.

## 2. Reorder the plan so the cheap answer stays cheap

- [x] 2.1 Resolve the release commit and read the existing tag before calling `waitForSuccessfulCi`.
- [x] 2.2 Return `relabel-only` without waiting for CI when the tag already points at the resolved commit.
- [x] 2.3 Keep the fail-closed throw when the tag exists at a different commit, and when CI has not succeeded on the resolved commit.
- [x] 2.4 Wait for CI on the resolved release commit and tag that commit.

## 3. Tests

- [x] 3.1 Tags the release commit when it is the branch head (existing behavior preserved).
- [x] 3.2 Tags the release commit when later non-release commits sit on top of it.
- [x] 3.3 No-ops when no commit in the window matches the manifest version.
- [x] 3.4 No-ops without a network call when the manifest version is not a release version.
- [x] 3.5 Returns `relabel-only` without waiting for CI when the tag already points at the resolved commit.
- [x] 3.6 Fails closed when the tag exists at a different commit.
- [x] 3.7 Fails closed when CI has not succeeded on the resolved release commit.
- [x] 3.8 The history search is bounded and takes the most recent match.

## 4. Validation

- [x] 4.1 `bun run lint`
- [x] 4.2 `bun run format:check`
- [x] 4.3 `bun run typecheck`
- [x] 4.4 `bun run test`
- [x] 4.5 `bun run openspec:validate`
- [x] 4.6 `bun run release:dry-run`

## 5. Delivery

- [ ] 5.1 Commit on `claude/tag-release-beyond-branch-head`.
- [ ] 5.2 Prepare the PR body from `.github/pull_request_template.md` and run `bun run pr:body:check`.
- [ ] 5.3 Push and open the PR.
- [ ] 5.4 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure state.
