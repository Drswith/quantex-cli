## 1. OpenSpec

- [x] 1.1 Create proposal, design, and agent-update spec delta for Bun untrusted probe fail-closed behavior.

## 2. Implementation

- [x] 2.1 Treat failed `bun pm -g untrusted` probes as trust failure while preserving empty successful listings.
- [x] 2.2 Add regression tests for non-zero untrusted probe exit codes on install and update.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
