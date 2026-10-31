# Proposal: fix-windows-upgrade-helper-parse

## Why

Windows standalone `quantex upgrade` reports `status=updated` / `ok=true` and then leaves the live binary unchanged. The delayed-replacement helper joins script lines with `; `, which inserts a statement terminator between each `try` block and its `catch`. Windows PowerShell rejects that at parse time, so the swap never runs. Published v1.13.5→v1.13.6 Windows CI reproduced the false success plus a leftover `.quantex-upgrade-*` directory.

## What Changes

- Emit the Windows delayed-replacement helper as complete PowerShell statements that stay valid after process-argument encoding.
- Pass that script to `powershell.exe` in a form that preserves newlines, instead of a semicolon-joined `-Command` string.
- Add regression coverage that the scheduled helper keeps each `try` adjacent to its `catch` and is not semicolon-joined.
- Do not change Unix in-place replacement, managed bun/npm self-upgrade, success-on-schedule semantics, or peer-alias copy rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: Windows delayed binary replacement MUST schedule a parseable PowerShell helper. A statement terminator MUST NOT appear between a `try` block and its matching `catch`.

## Impact

- `src/self/binary.ts` (`createWindowsReplacementCommand` / `scheduleWindowsBinaryReplacement`)
- `test/self-binary.test.ts`
- `openspec/specs/self-upgrade/spec.md` (via this change's delta)

No catalog, agent lifecycle, release-pipeline, or installer-script changes.

## Intake classification

Observable Windows binary self-upgrade correctness bug; OpenSpec required.
