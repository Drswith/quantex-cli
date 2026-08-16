## 1. Readiness contract

- [x] 1.1 Confirm the current public release remains `v1.10.0`, generated `2.0.0` PRs are closed, and no `v2.0.0` tag exists.
- [x] 1.2 Record the deny-by-default v2 refactor and 90-day stabilization requirement in OpenSpec.

## 2. Release enforcement

- [x] 2.1 Pause Release Please PR creation while the temporary v2 gate is active without disabling eligible tag recovery.
- [x] 2.2 Add a shared stable-v2 readiness predicate and enforce it in generated Release PR validation.
- [x] 2.3 Enforce the same predicate before deterministic tag creation and publication candidate validation.
- [x] 2.4 Add focused tests for preparation, PR, tag, stable publication, and prerelease boundaries.

## 3. Documentation and delivery

- [x] 3.1 Document the active release freeze, 90-day requirement, and future lift procedure.
- [x] 3.2 Run release-workflow validation, OpenSpec validation, and the release dry run.
- [x] 3.3 Commit, push, and update PR #560 as the active delivery artifact.
- [ ] 3.4 Obtain required CI, merge the gate, verify no v2 Release PR is recreated, and complete OpenSpec archive closure.
