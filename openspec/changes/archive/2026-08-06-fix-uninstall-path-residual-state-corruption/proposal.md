## Why

After a managed provider uninstall succeeds, Quantex still requires the agent binary to disappear from `PATH`. When another unrelated install of the same binary remains on `PATH`, postcondition verification fails and the uninstall command restores the just-cleared installed-agent state. That rewrites stale ownership for a package that is already gone, so the next `quantex uninstall` permanently returns `conflicting-source` and the lifecycle cannot be repaired without manual state edits.

## What Changes

- After a successful managed provider uninstall, re-check bound provider presence before restoring evidence on verification failure.
- When the bound provider is conclusively absent but a residual `PATH` binary remains, do **not** restore installed-agent state; clear the lifecycle receipt and classify the residual binary as untracked/conflicting rather than Quantex-owned.
- Keep the existing retain-evidence behavior when the bound provider is still present or provider evidence is indeterminate.
- Add a regression test for the dual-install / residual-`PATH` failure mode.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-uninstall`: distinguish residual untracked `PATH` binaries from failed managed-package removal when deciding whether to restore uninstall evidence.

## Impact

- `src/commands/uninstall.ts` postcondition failure handling
- `openspec/specs/agent-uninstall/spec.md` (via delta)
- `test/commands/uninstall.test.ts`
- Work-intake classification: observable CLI uninstall/state behavior → OpenSpec required
