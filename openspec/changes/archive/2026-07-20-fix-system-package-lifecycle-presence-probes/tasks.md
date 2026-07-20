## 1. Implementation

- [x] 1.1 Add cargo, deno, pip, and winget presence probing with `present` / `absent` / `unknown` outcomes and installed-version parsing where available
- [x] 1.2 Wire those probes into the provider adapters and managed-installer compatibility projections; attach deno binary names on provider bindings
- [x] 1.3 Add regression tests for presence probing and installer compatibility

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 2.2 Run `bun run openspec:validate`
