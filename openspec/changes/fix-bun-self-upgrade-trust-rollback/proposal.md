## Why

Work-intake classification: this change modifies observable Bun-managed self-upgrade and Bun `add -g` trust-failure rollback behavior, so OpenSpec is required before file edits.

After the lifecycle redesign, Bun self-upgrade runs through `runBunManagedSelfInstall`, which still calls `bun remove -g` whenever trust inspection or trust application fails (including cancel during trust). Self-upgrade intentionally reuses `bun add -g` against an already-present Quantex package, so a trust/probe failure uninstalls a working CLI. The shared `package-manager/bun` `add` path has the same unconditional rollback. Stale PR #457 targeted the pre-redesign API and does not cover `managed-process.ts`.

## What Changes

- Stop Bun-managed self-upgrade from uninstalling Quantex on trust/probe failure or trust-phase interruption.
- Gate shared Bun `add -g` rollback so only packages that were `absent` before add are removed when trust fails.
- Keep fail-closed success reporting when trust cannot complete.
- Add regression coverage for self-upgrade preservation and presence-gated agent-install rollback.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `self-upgrade`: Bun-managed self-upgrade MUST NOT uninstall an already-present Quantex package when trust fails after `bun add -g`.
- `agent-update`: Bun-managed `add -g` trust-failure rollback MUST only remove packages that were absent before the add.

## Impact

- Affected code: `src/self/providers/managed-process.ts`, `src/package-manager/bun.ts`
- Affected tests: `test/self/managed-process.test.ts`, `test/package-manager/bun.test.ts`
- Affected specs: `openspec/specs/self-upgrade/spec.md`, `openspec/specs/agent-update/spec.md` (via change deltas)
- Supersedes the still-open pre-redesign fix attempt in PR #457 for current `main`
