# Lifecycle External Teardown Plan

Base: `origin/main@79a4d098404337f5fea8ea5a442264fbc9b93486`

## Goal

Retire the live delivery infrastructure that existed only for the completed lifecycle integration phase. Remove the exact temporary ruleset and remote integration ref without changing `main`, the steady-state `main` ruleset, release allowlists, product code, or published artifacts.

## Earned state and live baseline

Cleanup PR #472 rebase-merged at `main@79a4d098404337f5fea8ea5a442264fbc9b93486`. Main CI run 29494534512 and Sandbox Tests run 29494534450 passed. Release run 29494738238 classified the commit without publishing; GitHub Release and npm remain at `v0.29.1`.

The live temporary resources are:

- repository ruleset `protect-lifecycle-integration` with id `18789571`, active only for `refs/heads/codex/redesign-lifecycle-integration`; its rules were pull-request enforcement, non-fast-forward protection, and required contexts `classify`, `lint`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`, and `sandbox-tests`
- remote ref `refs/heads/codex/redesign-lifecycle-integration` at `d1f76f6a4d055c9b14a25ddb3f30ac965d549216`

## Task 1: Record the teardown boundary

- Mark support task 5.2 complete from the merged cleanup evidence.
- Preserve the exact ruleset id, condition, required contexts, and remote ref tip in this plan before deletion.
- Confirm `origin/main` and the `protect-main` ruleset are out of scope.

## Task 2: Remove and verify live temporary resources

- Delete only repository ruleset id `18789571` through the GitHub API.
- Verify the exact ruleset is absent while `protect-main` remains active.
- Delete only remote branch `codex/redesign-lifecycle-integration`.
- Verify `git ls-remote` returns no matching head and `origin/main` remains at the accepted cleanup tip.
- Mark support task 5.3 complete only after all live-state checks pass.

## Task 3: Validate and deliver the evidence ledger

Run the focused steady-state workflow/governance tests with at most two workers, lint, format check, typecheck, OpenSpec validation, memory check, and diff check. Obtain independent review, create one conventional process-only commit, validate a template-based PR body, push, and create a Ready PR to `main`. Keep auto-merge disabled and use manual rebase-first merge after required checks pass.

## Closure boundary

This milestone removes only temporary external delivery infrastructure and records evidence. It must not publish a release or archive either active OpenSpec change. Current-spec synchronization and archive readiness remain tasks 5.4–5.6.
