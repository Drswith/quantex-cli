## 1. Release Guardrail Contract

- [x] 1.1 Create OpenSpec proposal, design, and release spec deltas for pre-major release guardrails.
- [x] 1.2 Configure stable release-please to bump pre-1.0 breaking changes as minor releases.
- [x] 1.3 Add Release PR validation for accidental `0.x` to `1.0.0` promotion.

## 2. Tests

- [x] 2.1 Add tests for accepting `0.21.1` to `0.22.0` Release PRs and rejecting `0.21.1` to `1.0.0`.
- [x] 2.2 Add tests that stable release-please config carries the pre-major bump option.

## 3. Validation And Delivery

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
- [x] 3.6 Run `bun run memory:check`.
- [ ] 3.7 Commit, push, and open the PR linked to issue #300.
