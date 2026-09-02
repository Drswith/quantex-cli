## 1. Workflow split

- [x] 1.1 In `.github/workflows/ci.yml`, gate `Validate PR body` and `Validate PR commit policy` so they skip when `github.event.pull_request.head.ref` starts with `release-please--branches--`
- [x] 1.2 Keep `Validate release PR policy` (and base-version setup) running on those release-please heads
- [x] 1.3 Remove unused `PR_IS_VALIDATED_RELEASE_PR` wiring from the body-check step once that step no longer runs on release-please heads
- [x] 1.4 Document the human-vs-release governance split in workflow comments next to the gated steps

## 2. Contracts, docs, and tests

- [x] 2.1 Complete OpenSpec proposal/design/specs for this change
- [x] 2.2 Update `test/pr-governance.test.ts` and `test/commit-policy.test.ts` (and any related workflow contract tests) to assert the skip conditions and that release-PR policy still runs
- [x] 2.3 Update `docs/runbooks/releasing-quantex.md` and `docs/github-collaboration.md` to describe the split
- [x] 2.4 Amend `docs/adr/0009-workflow-v2.md` with a short note on the governance split

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 3.2 Run focused/workflow contract tests and `bun run test` as needed
- [x] 3.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 3.4 Commit, push, and open a PR whose description states automated Release PRs are no longer blocked by human PR heuristics while release-PR policy still runs
