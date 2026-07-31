## 1. Contract and routing implementation

- [x] 1.1 Record the 1.4 Core-default route, bounded legacy escape, and non-goals in the OpenSpec change.
- [x] 1.2 Make Core the stable selector route for `install` and `ensure`, with the process-scoped legacy compatibility override.
- [x] 1.3 Extend focused routing tests for default selection, legacy escape, output isolation, and no cross-engine fallback.

## 2. Compatibility documentation

- [x] 2.1 Update ADR 0007 to record that the 1.4 routing promotion has been applied and remains bounded through 1.5.
- [x] 2.2 Update English and Simplified Chinese READMEs with the current CLI routing stage and retry control.

## 3. Validation and delivery

- [x] 3.1 Run focused routing and differential compatibility tests.
- [ ] 3.2 Run lint, format check, typecheck, full tests, OpenSpec validation, memory check, build, and release-artifact validation. (Local full Vitest runner remained idle after startup; CI owns the full-suite completion gate.)
- [x] 3.3 Commit one reviewable change, push it, create the implementation PR, and report release and archive follow-up ownership. (PR #527; release-please follows merge, and an agent-owned archive follow-up remains required after accepted spec sync.)
