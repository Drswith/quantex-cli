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
- [ ] 4.6 After merge, confirm Release Please prepares a `1.11.0` Release PR rather than `2.0.0`, and report validation, OpenSpec, git, commit, remote, PR, release, and archive-closure state.
