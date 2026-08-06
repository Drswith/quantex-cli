# Tasks

## 1. Remove the author-related gates

- [x] Delete `validateCommitTrailerPolicy` and the `Validate commit trailer policy` step from the `lint` job in `ci.yml`
- [x] Delete `validateCommitAuthorPolicy`, its risky-identity patterns, and the `--mode local` pre-push enforcement
- [x] Delete the single-commit rule for non-release pull requests
- [x] Delete `scripts/ci/strip-cursor-coauthor.ts`, its test, and the `commit-msg` hook entry
- [x] Reduce `scripts/ci/commit-policy.ts` to the `Release-As` footer consistency check and drop the now-meaningless `--mode` flag
- [x] Rename the governance step to `Validate PR commit policy` and update its invocation

## 2. Specs and docs

- [x] Remove the co-author trailer requirement from `openspec/specs/release-workflow/spec.md`
- [x] Remove the commit-msg hook requirement from `openspec/specs/code-quality-tooling/spec.md`
- [x] Drop the superseded pre-push delta from the merged-but-unarchived `align-governance-gates` change before it syncs into specs
- [x] Remove the `Commit authorship` section from `docs/github-collaboration.md`
- [x] Update `docs/runbooks/releasing-quantex.md`, which required re-authoring the release branch to satisfy the removed gate

## 3. Tests

- [x] Rewrite `test/commit-policy.test.ts` around the surviving `Release-As` rule
- [x] Add regression coverage asserting the removed gates stay removed (no trailer pattern, no agent identity list, no squash instruction, no `commit-msg` hook)
- [x] Update `test/pr-governance.test.ts` for the renamed step

## 4. Repository merge settings

- [x] Disable merge commits, which `release-workflow` already forbids, so the platform enforces the documented preference
- [x] Investigate squash message settings: rejected. GitHub only accepts `PR_BODY` together with `PR_TITLE`, and moving the squash body off the branch commit messages changes what release-please reads from the merged commit, including the `BEGIN_COMMIT_OVERRIDE` block. The observed trailers come from GitHub's automatic co-author attribution rather than message text, so the change carries release risk for negligible benefit
- [x] Record that rebase merge, not squash, is what preserved a bot commit author on `main`; the linear-history preference in `release-workflow` is the path that produced the attribution it was trying to avoid

## 5. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [x] Commit, push, PR with a `pr:body:check`-validated body (#588, merged)
