## 1. Release Guardrails

- [x] 1.1 Configure stable release-please to keep pre-1.0 breaking changes on the zero-major minor line.
- [x] 1.2 Add Release PR validator logic that rejects accidental `0.x` to `1.0.0` promotion.
- [x] 1.3 Add Release PR validator logic that rejects burned stable release version `1.0.0`.

## 2. Contract and Tests

- [x] 2.1 Add OpenSpec deltas for release governance and release workflow.
- [x] 2.2 Add tests for accepted `0.x` minor release, rejected `1.0.0`, and normal post-1.0 release advancement.
- [x] 2.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
