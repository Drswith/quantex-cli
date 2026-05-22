## 1. Contract

- [x] 1.1 Write proposal, design, and code-quality-tooling spec delta for uv-managed sandbox coverage.

## 2. Implementation

- [x] 2.1 Add a deterministic fake-uv lifecycle scenario to `scripts/lifecycle-smoke.ts`.
- [x] 2.2 Include `uv-managed` in the default scenario set and trusted PR sandbox profile.
- [x] 2.3 Update sandbox runbook guidance for the new scenario.
- [x] 2.4 Add or update automated tests covering the new isolation scenario wiring.

## 3. Validation

- [x] 3.1 Run targeted tests for sandbox workflow/scenario changes.
- [x] 3.2 Run `bun run lint`.
- [x] 3.3 Run `bun run format:check`.
- [x] 3.4 Run `bun run typecheck`.
- [x] 3.5 Run `bun run test`.
- [x] 3.6 Run `bun run openspec:validate`.
- [x] 3.7 Run `bun run memory:check`.

## 4. Delivery

- [x] 4.1 Commit, push, open PR, and report PR/archive/release closure state.
