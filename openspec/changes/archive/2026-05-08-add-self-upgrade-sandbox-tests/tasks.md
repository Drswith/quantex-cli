## 1. Contract

- [x] 1.1 Write the OpenSpec proposal, design, and code-quality-tooling delta for managed self-upgrade sandbox coverage.
- [x] 1.2 Update maintainer runbooks for the new isolated self-upgrade scenario.

## 2. Implementation

- [x] 2.1 Extend `scripts/lifecycle-smoke.ts` with a Bun-managed self-upgrade scenario backed by a local sandbox registry and seeded older package version.
- [x] 2.2 Add or update automated tests that cover the isolation harness changes introduced by the new scenario.

## 3. Validation

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
