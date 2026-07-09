## 1. Compatibility Baseline

- [x] 1.1 Extend `test/commands/install.test.ts` with stable structured-result assertions for adoptable existing installs, ambiguous existing installs, tracking cancellation, and lifecycle lock data.
- [x] 1.2 Extend `test/commands/ensure.test.ts` with stable structured-result assertions for dry-run, install failure, tracking cancellation, and lifecycle lock data.
- [x] 1.3 Run `bun run test -- test/commands/install.test.ts test/commands/ensure.test.ts` and confirm the characterization tests pass against the current implementation before refactoring.

## 2. Shared Install/Ensure Lifecycle Service

- [x] 2.1 Create `test/services/install-ensure.test.ts` with failing tests for `agent-not-found`, `already-installed`, `would-track-existing`, `tracked-existing`, `untracked-existing`, `would-install`, `installed`, `install-failed`, `tracking-cancelled`, and `resource-locked` outcomes.
- [x] 2.2 Run `bun run test -- test/services/install-ensure.test.ts` and confirm it fails because `src/services/install-ensure.ts` does not exist.
- [x] 2.3 Create `src/services/install-ensure.ts` with `runInstallEnsureLifecycle(agentName, options, dependencies)` and a command-neutral discriminated outcome.
- [x] 2.4 Keep the default dependencies limited to `resolveAgentInspection`, `getAdoptableExistingInstallMethod`, `trackInstalledAgent`, `installAgent`, and `isResourceLockError`; pass `dryRun` and `onMutationStart` explicitly.
- [x] 2.5 Run `bun run test -- test/services/install-ensure.test.ts` and confirm all service tests pass.

## 3. Command Migration

- [x] 3.1 Refactor the single-agent path in `src/commands/install.ts` to preserve its pre-start cancellation check and map shared service outcomes to the existing install results, warnings, errors, and started events.
- [x] 3.2 Run `bun run test -- test/services/install-ensure.test.ts test/commands/install.test.ts` and confirm install compatibility remains green.
- [x] 3.3 Refactor `src/commands/ensure.ts` to map the same service outcomes to the existing ensure results, warnings, errors, and started events.
- [x] 3.4 Run `bun run test -- test/services/install-ensure.test.ts test/commands/install.test.ts test/commands/ensure.test.ts` and confirm both command suites remain green.
- [x] 3.5 Remove duplicate inspection, adoption, tracking, installation, and lock-classification imports and branches from the command files without changing batch install aggregation or human renderers.

## 4. Validation

- [x] 4.1 Run `bun run lint`.
- [x] 4.2 Run `bun run format:check`.
- [x] 4.3 Run `bun run typecheck`.
- [x] 4.4 Run `bun run test`.
- [x] 4.5 Run `bun run openspec:validate`.
- [x] 4.6 Run `bun run memory:check`.
- [x] 4.7 Re-run `bun run openspec:status -- --change extract-install-ensure-lifecycle-service` and confirm every implementation task is complete.

## 5. Delivery Closure

- [x] 5.1 Review the final diff for public-contract drift and unintended changes outside the approved scope.
- [x] 5.2 Commit the implementation and completed OpenSpec tasks on `codex/lifecycle-compatibility-refactor`.
- [x] 5.3 Prepare a PR body file from `.github/pull_request_template.md` and validate it with `bun run pr:body:check`.
- [x] 5.4 Push the branch and create the PR with the validated body file.
- [x] 5.5 Report validation, OpenSpec, git, commit, push, PR, merge, release, and archive-closure state.
