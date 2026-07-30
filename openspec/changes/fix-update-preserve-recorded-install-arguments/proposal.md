## Why

Lifecycle receipts cannot store package install arguments, but observation prefers the receipt binding over installed state. After a managed install writes both state and a receipt, `quantex update` / `update --all` silently drops recorded arguments such as Cargo `--locked`, uv `--python`, and Deno permission flags, violating the agent-update contract while reporting success.

## What Changes

- When installed-state and receipt provider identities agree, observation MUST merge the recorded state install arguments into the persisted binding used for update planning and execution.
- Keep receipt preference for executable identity metadata that receipts already carry.
- Do not broaden receipt schema in this change.
- Add regression coverage for Cargo/uv/Deno observation and update planning with recorded arguments plus a matching receipt.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: clarify that lifecycle observation/reconciliation MUST preserve recorded package install arguments from installed state when composing the binding used for managed update, even when a narrower lifecycle receipt is also present.

## Impact

- Affected code: `src/lifecycle/provider-binding.ts`, `src/lifecycle/agent-observation.ts`, related unit tests.
- No CLI flags, schema version, command catalog, or receipt schema changes.
- Work-intake classification: observable update behavior and durable agent-update contract require OpenSpec.
