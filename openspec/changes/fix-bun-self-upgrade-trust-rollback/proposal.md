## Why

Bun-managed `quantex upgrade` reuses `bun add -g` for an already-installed Quantex package. When trust verification fails afterward, Quantex runs `bun remove -g quantex-cli` and uninstalls the only Bun-managed install. That turns a failed upgrade into self-removal.

## What Changes

- Restrict Bun install trust-failure rollback to packages that were absent from Bun globals before `bun add -g`.
- Keep fail-closed reporting when the untrusted probe or trust step fails.
- Preserve rollback for true first-install attempts so agent install fallback still avoids duplicate Bun globals.
- Clarify self-upgrade and agent-update contracts so Bun self-upgrade cannot uninstall an existing Quantex install on trust/probe failure.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `agent-update`: Bun install trust-failure rollback applies only to newly added packages (absent before `add`).
- `self-upgrade`: Bun-managed self-upgrade must not remove an existing Quantex install when trust verification fails after `bun add -g`.

## Impact

- Code: `src/package-manager/bun.ts`, related package-manager and self-upgrade tests.
- Behavior: Bun first-install rollback unchanged; Bun re-add / self-upgrade trust failure no longer uninstalls an existing package.
- Intake classification: observable upgrade/install behavior → OpenSpec required before implementation.
