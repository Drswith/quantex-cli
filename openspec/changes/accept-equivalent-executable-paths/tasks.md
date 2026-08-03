## 1. Lifecycle path reconciliation

- [x] 1.1 Route executable-path canonicalization through lifecycle observation ports.
- [x] 1.2 Compare receipt, provider, and live executable paths by canonical identity while preserving distinct-path conflicts.

## 2. Regression coverage

- [x] 2.1 Add lifecycle observation tests for equivalent symbolic-link paths and genuinely distinct targets.
- [x] 2.2 Add update planning coverage proving a tracked managed agent is no longer blocked by equivalent receipt and live paths.

## 3. Validation and delivery

- [x] 3.1 Run focused regression tests plus lint, format check, typecheck, full tests, and OpenSpec validation.
- [x] 3.2 Commit and push one release-worthy fix commit with a validated PR body, then open the implementation PR.
- [ ] 3.3 Merge the implementation after required checks, close the OpenSpec archive follow-up, and verify the patch release in GitHub and npm.
