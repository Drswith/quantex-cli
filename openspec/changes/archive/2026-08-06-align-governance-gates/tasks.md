# Tasks

## 1. PR template satisfies its own validator

- [x] Restate `## Linked Artifacts` in `.github/pull_request_template.md` using the existing `## Release Intent` option-list style, so the shipped template passes `validatePrBodyPolicy` unmodified
- [x] Verify by hand: `bun run pr:body:check -- --body-file .github/pull_request_template.md --title "chore: some change"` passes

## 2. Lock template/validator consistency

- [x] `test/pr-governance.test.ts`: assert the shipped template contains every `requiredPrBodyHeadings` entry (it already owns the template/governance assertions)
- [x] `test/pr-governance.test.ts`: assert the shipped template passes `validatePrBodyPolicy` with no issues
- [x] `test/pr-governance.test.ts`: assert both `release-please-config.json` and `release-please-config.beta.json` `pull-request-header` values still pass
- [x] Confirm the lock can fail: reverting the template, and renaming a required heading, each turn the suite red

## 3. Local commit-policy mode

- [x] Extract `validateCommitAuthorPolicy` so local and CI enforcement share one implementation per rule
- [x] Add `--mode local` to `scripts/ci/commit-policy.ts`: resolve current-branch commits via git and run the shared validators
- [x] Scope local enforcement to the trailer and author-identity rules; leave the single-commit rule to merge-time governance so work-in-progress pushes are not blocked
- [x] Resolve the comparison base safely (missing remote, unresolvable base, or no commits must be a clean no-op, never a false failure)
- [x] Wire `ci:commit-policy -- --mode local` into the `pre-push` hook in `package.json`
- [x] `test/commit-policy.test.ts`: cover local-mode parsing, no-op cases, both rejection rules, and the merge-time-only scope of the single-commit rule

## 4. Spec and docs

- [x] Document the required author identity for agent-driven sessions in `docs/github-collaboration.md`
- [x] Spec deltas stay in `openspec/changes/align-governance-gates/specs/`; they sync into `openspec/specs/` during archive closure after merge

## 5. Validation and delivery

- [x] `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] `bun run test`
- [x] `bun run openspec:validate`, `bun run memory:check`
- [x] Commit, push, PR with a `pr:body:check`-validated body (#587, merged)
