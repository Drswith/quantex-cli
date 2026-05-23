## Why

This implementation request changes VTCode agent catalog metadata and observable install behavior, so it requires an OpenSpec-backed change before editing. `qtx install vtcode` currently tries the upstream Windows PowerShell installer first even though the latest upstream releases still omit the Windows zip asset that installer expects, producing confusing failure output before Cargo fallback starts.

## What Changes

- Prefer the Cargo-managed VTCode install method before the upstream PowerShell script on Windows.
- Keep the upstream Windows script installer available as a fallback/install-guidance method instead of removing it from the catalog.
- Add regression coverage so the Windows VTCode method order remains Cargo first, then script.
- Update the `agent-catalog` spec delta for VTCode Windows installation behavior.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Refine VTCode Windows install method ordering so the managed Cargo path is attempted before the upstream native script while upstream Windows release assets are absent.

## Impact

- `src/agents/catalog/vtcode.json` - reorder Windows VTCode install methods.
- `test/agents.test.ts` - assert the Windows VTCode install method order.
- `openspec/changes/fix-vtcode-windows-install-order/specs/agent-catalog/spec.md` - document the catalog contract delta.
