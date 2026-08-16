## Why

PR #632 fixed a real `qtx uninstall` failure caused by an update-written lifecycle receipt carrying the agent's default executable name while package-provider state omitted it. The existing canary appears to cover `install -> update -> uninstall`, but the install is already at the registry latest version, so update is always a no-op and never exercises the receipt-writing branch.

## What Changes

- Add a focused real-agent canary path for the `opencode` Bun package provider that seeds the highest available stable version below `latest`, adopts it through Quantex, performs a real `qtx update --refresh`, verifies that update wrote the executable-bearing lifecycle receipt, and lets the following uninstall consume that receipt.
- Add one lifecycle-receipt contract test that exercises the legacy install writer, Core install writer, and update writer across every first-party provider type, then validates each persisted receipt through the provider-binding readers and default-executable reconciliation used by uninstall.
- Record the real-upgrade and writer/reader contract requirements in the existing `agent-canary-validation` OpenSpec capability.

No CLI schema, persisted receipt format, provider classification, or uninstall error contract changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-canary-validation`: require a real provider upgrade in update coverage and a cross-writer lifecycle-receipt contract gate.

## Impact

- Affected source: `scripts/smoke/lifecycle-smoke.ts`.
- Affected tests: lifecycle receipt/provider-binding contract coverage and static smoke scenario assertions.
- Affected durable artifact: `openspec/specs/agent-canary-validation/spec.md` through the change delta.
- Runtime dependencies remain unchanged; the canary uses the existing npm registry and Bun toolchain already required by the selected provider.

Work-intake classification: non-trivial validation workflow and durable canary contract change; OpenSpec is required before implementation.
