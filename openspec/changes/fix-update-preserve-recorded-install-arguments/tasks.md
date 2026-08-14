## 1. Binding composition

- [x] 1.1 Add `resolvePersistedProviderBinding` that overlays state install arguments onto an identity-matching receipt binding
- [x] 1.2 Use the helper in `observeAgentLifecycle` instead of `receiptBinding ?? stateBinding`
- [x] 1.3 Export the helper from the lifecycle surface used by tests

## 2. Regression coverage

- [x] 2.1 Add unit coverage for argument overlay when state and receipt identities agree
- [x] 2.2 Add observation coverage proving Cargo/uv/Deno recorded arguments survive a matching receipt
- [x] 2.3 Add update-service coverage proving the planned managed update target retains recorded arguments

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate`
