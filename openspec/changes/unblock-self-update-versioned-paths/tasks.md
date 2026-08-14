## 1. Scope receipt path evidence to the receipt's version

- [x] 1.1 In `src/lifecycle/agent-observation.ts`, resolve the live version for the recorded-binding branch from the executable observation, falling back to a present provider observation's version.
- [x] 1.2 Skip the receipt-path comparison when `versionsConflict(receipt?.version, liveVersion)` is true, keeping the comparison for equal versions and for any unknown version.
- [x] 1.3 Confirm `providerPathConflicts`, `versionsConflict` on provider-vs-live, and `executableIdentityConflicts` are unmodified.
- [x] 1.4 Confirm `src/services/lifecycle-updates.ts` needs no edit: `verifySelfUpdatedObservation` already gates on `sameBinding` and version monotonicity.

## 2. Surface the update failure reason

- [x] 2.1 In `src/commands/update.ts`, print the result `message` on the `failed` branch of `renderUpdateHuman` when present, keeping the existing single-line style and the `hint` line.
- [x] 2.2 Confirm the structured payload is unchanged and no reconciliation branch reads the message text.

## 3. Tests

- [x] 3.1 Observation: a receipt path under a previous version-specific directory with a newer live version produces no drift.
- [x] 3.2 Observation: differing paths at the same recorded version still produce `conflicting-source` drift.
- [x] 3.3 Observation: differing paths with an unknown receipt or live version still produce `conflicting-source` drift.
- [x] 3.4 Update planning: a tracked unmanaged agent with a stale recorded path plans the self-update strategy instead of blocking as `unsafe-source`.
- [x] 3.5 Update execution: a self-update that relocates the executable to a newer version reports `updated` and writes a receipt with the new path and version.
- [x] 3.6 Update execution: a self-update with no version change on a stale receipt reports `up-to-date` and refreshes the receipt.
- [x] 3.7 Human output: a blocked update failure line includes the reason; a failure without a reason keeps the existing line.

## 4. Validation

- [x] 4.1 `bun run lint`
- [x] 4.2 `bun run format:check`
- [x] 4.3 `bun run typecheck`
- [x] 4.4 `bun run test`
- [x] 4.5 `bun run openspec:validate`

## 5. Delivery

- [ ] 5.1 Commit on `claude/cursor-cli-update-failure-f15aef` as a single commit.
- [ ] 5.2 Prepare the PR body from `.github/pull_request_template.md` and run `bun run pr:body:check`.
- [ ] 5.3 Push and open the PR.
- [ ] 5.4 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure state.
