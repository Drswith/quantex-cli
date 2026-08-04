## 1. Emergency withdrawal

- [x] 1.1 Revert the unsealed 2.0.0 version candidate to the published 1.7.1 source version.
- [x] 1.2 Verify that no v2 tag, GitHub Release, npm package, or release workflow run exists.

## 2. Deferred-major gate

- [x] 2.1 Add deny-by-default v2 release policy.
- [x] 2.2 Enforce readiness in generated Release PR validation and the seal contract.
- [x] 2.3 Add focused tests for the deferred v2 policy.

## 3. Documentation and delivery

- [x] 3.1 Document the required future refactor-completion and 90-day activation path.
- [x] 3.2 Run release-workflow validation and OpenSpec validation.
- [ ] 3.3 Commit, push, deliver, and merge the emergency withdrawal PR.
