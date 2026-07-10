## 1. Process-Only Bootstrap

- [x] 1.1 Add focused workflow-classification tests proving CI and Sandbox Tests add exact base `codex/redesign-lifecycle-integration` only to `pull_request`, never to `push`, and produce live contexts `classify`, `lint`, all three platform `test` contexts, and `sandbox-tests`; also prove PR Governance retains its unfiltered all-PR trigger without being treated as a required ruleset context.
- [x] 1.2 Update only the CI and Sandbox Tests `pull_request` base filters needed by the integration tests, keep both workflows' `push` filters on `main`/`beta`, and leave PR Governance without a base filter.
- [x] 1.3 Add focused release regression tests proving the existing positive `main`/`beta` allowlist rejects integration for Release `workflow_run`, manual target selection, and Release PR targeting/validation before release-target resolution or npm tag/channel derivation can run.
- [x] 1.4 Keep the production Release workflow, Release PR, policy, and resolver surfaces unchanged when the regression tests pass; only if a test exposes a concrete allowlist gap, make the smallest correction and prove it with that regression.
- [x] 1.5 Add focused PR-policy tests for the ordinary single-commit rule, both exact same-repository multi-commit topology exceptions, and fork/ref/lookalike near misses; retain actual merge-commit delivery verification in runtime tasks 3.3 and 4.4.
- [x] 1.6 Update PR Governance payload collection and merge-commit policy logic to satisfy the topology tests without granting any other multi-commit exception.
- [ ] 1.7 Clarify only `redesign-lifecycle-engine` task `11.6` so it tracks readiness of the explicit post-promotion spec-sync/archive follow-up; preserve its number, checkbox, 74-task denominator, implementation scope, and completion credit, leave it unchecked during the clarification, and do not perform spec sync or archive before promotion.
- [x] 1.8 Add the setup/runtime/teardown procedure to the canonical delivery runbook and route the central Quantex runtime skill to it without expanding thin agent bootstraps.
- [x] 1.9 Run the focused workflow/policy tests, `bun run test`, `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check` for the complete bootstrap diff.
- [x] 1.10 Prepare and validate a process-only PR body, verify the diff contains no lifecycle redesign implementation and changes no redesign task number, checkbox count, denominator, implementation scope, or earned completion credit, and deliver the one allowed bootstrap pull request to `main`.
- [x] 1.11 Merge the bootstrap through the ordinary single-commit path only after the six live `main` contexts succeed, then record merge closure separately from release and archive closure.

## 2. Integration Setup

- [x] 2.1 Before protection, synchronize `codex/redesign-lifecycle-integration` to the exact post-bootstrap `main` tip and verify the live remote comparison is zero commits ahead and zero commits behind.
- [x] 2.2 Create the temporary integration ruleset requiring pull requests and exact contexts `classify`, `lint`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`, and `sandbox-tests`, and disallow direct updates after initialization.
- [ ] 2.3 Verify from live repository state that an integration-target pull request receives all six contexts, PR Governance runs separately through its unfiltered trigger, integration push triggers are absent from CI and Sandbox Tests, and no release entry point accepts the branch.
- [x] 2.4 Add a focused lint-staged regression and configure both oxfmt tasks so a matched set containing only formatter-ignored lifecycle fixtures is a successful no-op while supported staged files, `oxlint --fix`, and real failure propagation remain enforced.

## 3. Milestone Runtime

- [ ] 3.1 Deliver each `redesign-lifecycle-engine` milestone as an ordinary single-commit pull request to the protected integration branch and require all six contexts before merge; retain the existing allowed merge methods for these ordinary pull requests rather than imposing the exceptional merge-commit rule.
- [ ] 3.2 After each milestone merge, update only redesign tasks actually completed, run the milestone's required validation, and report milestone closure while both OpenSpec changes remain active.
- [ ] 3.3 Whenever `main` advances, use only a same-repository pull request with base `codex/redesign-lifecycle-integration` and head `main`, merge it with a merge commit after all checks pass, and verify the resulting two-parent topology.
- [ ] 3.4 Confirm throughout runtime that integration produces no Release workflow run, Release PR, npm tag/channel, package publication, or archive eligibility.

## 4. Final Promotion

- [ ] 4.1 Complete the other 73 `redesign-lifecycle-engine` tasks on their existing terms and satisfy clarified task `11.6` post-promotion follow-up readiness so the unchanged 74-checkbox denominator reports exactly `74/74`; run its final test, build, binary, package, and release-artifact gates, but defer actual current-spec synchronization and archive execution to tasks 5.4 and 5.5.
- [ ] 4.2 Perform a final verified same-repository main-sync merge, refresh both remote refs, prove the current `main` tip is an ancestor of integration, and confirm no lifecycle milestone pull request remains open.
- [ ] 4.3 Review the complete integration-to-`main` comparison for only accepted redesign work, validate the PR body, and open the exact same-repository final-promotion pull request.
- [ ] 4.4 After every required `main` context succeeds, merge final promotion with a merge commit and verify its two parents are the approved refreshed `main` and integration tips.
- [ ] 4.5 Let normal post-merge `main` release automation classify the promoted product delta and report promotion, release, and still-pending archive closure separately.

## 5. Post-Promotion Teardown

- [ ] 5.1 Add or update focused steady-state tests, then prepare a process-only cleanup that removes the integration pull-request target from CI and Sandbox Tests, temporary multi-commit policy exceptions, and temporary runtime/runbook instructions while retaining release rejection for unknown branches.
- [ ] 5.2 Run the focused tests, full test suite, lint, format check, typecheck, OpenSpec validation, and memory check; validate the cleanup PR body and merge the cleanup to `main` without treating it as a release.
- [ ] 5.3 Remove the temporary integration ruleset, delete `codex/redesign-lifecycle-integration`, and verify both are absent from live repository state after recovery use is no longer required.
- [ ] 5.4 Synchronize the accepted final deltas from `redesign-lifecycle-engine` and `support-integration-branch-delivery` into current specs, retaining only durable conditional and closure rules.
- [ ] 5.5 Run `bun run openspec:validate` and `bun run memory:check`, then use the repo-native archive-closure flow and validated PR body to archive both active changes through the normal protected-branch PR path.
- [ ] 5.6 After the archive follow-up merges, verify both changes are under `openspec/changes/archive/`, no active task remains, the working branch is clean, and promotion, release, teardown, and archive closure states are all reported explicitly.
