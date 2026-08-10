## 1. Correct the source label

- [x] 1.1 Return `detected on disk` from the untracked branch of `formatInstalledSource` in `src/utils/install.ts`, and document at the definition why the label names no resolution mechanism.
- [x] 1.2 Map the corrected label to the `detected` Source column value in `formatListSource` in `src/commands/list.ts`.

## 2. Correct the untracked-agent guidance

- [x] 2.1 Reword the `AGENT_UNTRACKED_IN_PATH` diagnostic message in `src/commands/doctor.ts` to describe the agent as detected but not tracked, keeping the issue code unchanged.
- [x] 2.2 Reword `getUntrackedPathAgentUpdateMessage` in `src/agent-update/messages.ts` the same way.
- [x] 2.3 Confirm `SELF_INSTALLER_MISSING` in `src/commands/doctor.ts` still references `PATH` and is left unmodified.

## 3. Update pinned expectations

- [x] 3.1 Update the two untracked `sourceLabel` expectations in `test/compatibility/agent-inspection.test.ts`.
- [x] 3.2 Update the `sourceLabel` expectations in `test/commands/inspect.test.ts`, `test/commands/resolve.test.ts`, and `test/commands/list.test.ts`.
- [x] 3.3 Update the untracked-agent message expectations in `test/commands/update.test.ts` and `test/commands/doctor.test.ts`.
- [x] 3.4 Update the untracked baselines in `scripts/smoke/read-only-lifecycle-smoke.ts`.
- [x] 3.5 Regenerate the `list` v1 command-family goldens in `test/fixtures/compatibility/v1/command-families.json` with `UPDATE_V1_COMMAND_GOLDENS=1`, and confirm the diff touches only the `list` `json`/`ndjson` hashes.
- [x] 3.6 Confirm `installSource: 'detected-in-path'` in `test/commands/resolve.test.ts` and the smoke baseline is unchanged.
- [x] 3.7 Confirm `test/fixtures/compatibility/v1/root-declaration.json` and `root-exports.json` are untouched.

## 4. Regression coverage

- [x] 4.1 Add coverage asserting the untracked label is identical whether the executable resolves through `PATH` or only through a known install directory.
- [x] 4.2 Add coverage asserting no untracked-agent source label or guidance message claims `PATH` membership.

## 5. Documentation

- [x] 5.1 Update the untracked-agent phrasing in `docs/runbooks/quantex-troubleshooting.md`.

## 6. Validation and closure

- [x] 6.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 6.2 Run `bun run test`.
- [x] 6.3 Run `bun run openspec:validate`.
- [x] 6.4 Run `bun run memory:check`.
- [x] 6.5 Verify the reproduction against a disposable `HOME` carrying a known-directory-only executable.
- [ ] 6.6 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure status.
