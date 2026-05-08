## 1. Contract

- [x] 1.1 Write the proposal, design, and self-upgrade delta for the transactional self-upgrade rewrite.

## 2. Implementation

- [x] 2.1 Add internal self-upgrade facts, target, and plan types plus planner helpers.
- [x] 2.2 Refactor `inspectSelf()`, `upgradeSelf()`, and self-upgrade providers to consume the new plan model.
- [x] 2.3 Simplify `src/commands/upgrade.ts` so it renders the planner result instead of re-implementing update-availability decisions.

## 3. Validation

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
