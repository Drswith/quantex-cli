## 1. Spec And Design

- [x] 1.1 Document the stale latest-version downgrade bug and the intended self-update availability behavior in proposal, design, and self-upgrade spec deltas.

## 2. Implementation

- [x] 2.1 Add semantic self-version comparison and use it to suppress stale or lower self-update targets in `upgrade`, `doctor`, and passive notices.
- [x] 2.2 Add regression tests covering stale latest-version behavior for upgrade, doctor, and self-update notices.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 3.2 Run `bun run test`.
- [x] 3.3 Run `bun run openspec:validate`.
