## 1. Restore the published v1 update surface

- [x] 1.1 Restore `src/commands/update.ts` to its `d92c7bc^1` content: the `managed` parameter, the `--managed` without `--all` `INVALID_ARGUMENT` rejection, the `'managed'` scope, and the managed batch wiring in `createUpdateCommandInvocation`.
- [x] 1.2 Restore `createManagedLifecycleUpdateBatchInvocation` and the `createLifecycleUpdateBatchInvocationFor` parameterization in `src/services/lifecycle-updates-production.ts`.
- [x] 1.3 Restore the `managed` argument pass-through in `src/command-contract/handlers.ts`.
- [x] 1.4 Restore the `--managed` option and the `nonInteractive` global option on the `update` contract in `src/command-contract/registry.ts`.
- [x] 1.5 Confirm nothing under `apps/desktop/`, no desktop script, no desktop CI job, and no `macos-desktop-client` spec returns, and leave `test/workflow-classification.test.ts` at its post-revert shape.

## 2. Tests and goldens

- [x] 2.1 Restore the managed-update cases in `test/commands/update.test.ts`.
- [x] 2.2 Restore the managed batch planning case in `test/services/lifecycle-updates-production.test.ts`.
- [x] 2.3 Regenerate the v1 command-family goldens with `UPDATE_V1_COMMAND_GOLDENS=1`, and confirm only the `update` digests move back to their pre-revert values.

## 3. Resume release preparation

- [x] 3.1 Remove `skip-github-pull-request: true` and its deferred-v2 comment from `.github/workflows/release-please.yml`.
- [x] 3.2 Confirm `scripts/ci/release-pr-policy.ts`, `scripts/release/tag-release.ts`, and `scripts/release/release-seal-contract.ts` still deny a stable `2.x` through `release-readiness.ts`, and that no test asserting that denial changes.
- [x] 3.3 Update the temporary stable-v2 section of `docs/releases.md`: preparation resumes, the three version-naming denial layers stay, the readiness requirement is unchanged, and the one-shot 1.x escape path is no longer needed.
- [x] 3.4 Update the corresponding section of `docs/runbooks/releasing-quantex.md`.
- [x] 3.5 Update `test/release-target-resolution.test.ts` and any workflow-classification assertion that pins `skip-github-pull-request`.

## 4. Validation and delivery

- [x] 4.1 Verify the restored surface end to end: `bun run dev -- update --all --managed --dry-run --output json` plans only persisted agents, `bun run dev -- update --managed` reports `INVALID_ARGUMENT`, and `bun run dev -- update --non-interactive` is accepted.
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 4.4 Run `bun run release:dry-run`, because this change edits `release-please.yml`.
- [x] 4.5 Open the PR with a body validated by `bun run pr:body:check`, declaring a minor release intent and a commit override for the restored options.
- [x] 4.6 After merge, confirm what Release Please prepares. It prepared `chore: release 2.0.0` (#669), because `d92c7bc revert!:` is still inside the `v1.10.0..main` range and release-please reads the marker rather than whether it still describes a removal. Recorded as a correction in the proposal and design.

## 5. One-shot 1.11.0 preparation

- [x] 5.1 Confirm the generated `2.0.0` Release PR is rejected rather than mergeable, so the narrowed gate behaves as the `release-workflow` and `major-release-readiness` deltas specify: `governance` fails on #669 with the deferred-readiness reason.
- [x] 5.2 Prove `1.11.0` is the honest version by comparing the v1 compatibility fixtures between `v1.10.0` and `main`: identical root exports, no command or alias added or removed, no exit code changed, and only catalog-derived digests moved.
- [x] 5.3 Close the governance gap that blocks a boundary-only one-shot: `pr-body-policy` rejected any process-only PR carrying `Release-As`, so a PR whose only purpose is moving the release boundary had no path. Allow it when the declared major is at or below the current released major, keep rejecting a release-worthy title or `BREAKING CHANGE`, and fail closed when the current major is unknown. Cover all four cases in `test/pr-body-policy.test.ts` and record the rule in `release-workflow` and the release runbook.
- [x] 5.4 Carry `Release-As: 1.11.0` in the delivery commit message and repeat the footer under `## Release Summary`, satisfying `pr-body-policy` and `commit-policy`.
- [x] 5.5 After merge, confirm what Release Please prepares. It still prepared `2.0.0`: the `Release-As` footer in #670 was not honoured. The delivery commit body wrapped so that one line began with the words `BREAKING CHANGE`, which a conventional-commit parser reads as a breaking-change footer, so the message carried a second breaking marker alongside the override.
- [ ] 5.6 Re-trigger with the canonical form documented by release-please: a commit whose body contains the `Release-As` footer and nothing a parser can mistake for another footer. Keep the message short and ensure no line begins with a footer token.
- [ ] 5.7 Confirm Release Please replaces the `2.0.0` Release PR with `1.11.0` and that `governance` passes on it.
- [ ] 5.8 Merge the Release PR, confirm `tag-release` tags `v1.11.0` and `release.yml` publishes, then verify the published package accepts `qtx update --all --managed` and `qtx update --non-interactive`.
- [ ] 5.9 Report validation, OpenSpec, git, commit, remote, PR, release, and archive-closure state.
