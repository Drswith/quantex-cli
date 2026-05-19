## 1. OpenSpec

- [x] 1.1 Finalize the proposal, design, and spec deltas for passive self-upgrade reminders.

## 2. Implementation

- [x] 2.1 Extend self state to persist passive self-upgrade reminder throttle metadata.
- [x] 2.2 Add a self-upgrade notice helper that evaluates output mode, command ownership, upgrade availability, and throttle state.
- [x] 2.3 Invoke the passive self-upgrade notice from the shared runtime without changing structured command results.

## 3. Validation

- [x] 3.1 Add or update tests for state persistence and runtime reminder behavior.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 4. Delivery

- [x] 4.1 Review git state, commit the change, push the branch, and open a PR with a validated body file.
