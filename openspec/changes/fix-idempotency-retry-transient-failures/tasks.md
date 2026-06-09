## 1. Implementation

- [x] 1.1 Persist idempotency records only for `ok: true` results in `storeIdempotentResult()`.
- [x] 1.2 Add regression test proving timeout failures do not block idempotency-key retries.

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 2.2 Run `bun run openspec:validate`.
