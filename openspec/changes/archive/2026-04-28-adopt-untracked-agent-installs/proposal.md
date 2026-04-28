## Why

`quantex update --all` intentionally skips supported agents that are only detected in `PATH` and have no recorded Quantex install state. That safety boundary is correct, but the current remediation loop breaks for agents like Cursor CLI: `quantex install cursor` and `quantex ensure cursor` stop at "already installed" instead of recording the existing install, so the agent can never graduate from untracked `PATH` detection into Quantex-managed lifecycle state.

## What Changes

- Allow `quantex install <agent>` and `quantex ensure <agent>` to adopt an existing supported install into Quantex state when the current platform exposes exactly one unambiguous unmanaged install method for that agent.
- Keep refusing to guess install ownership for ambiguous `PATH` detections, but replace the misleading "already installed" no-op with output that explains the install is still untracked.
- Add regression coverage for Cursor-like script installs so a pre-existing binary can become tracked and then participate in `quantex update --all`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: install-source reconciliation may record a safely identifiable existing install so later batch updates can use tracked state without guessing.

## Impact

- Affected code: `src/commands/install.ts`, `src/commands/ensure.ts`, `src/package-manager/`, `src/utils/install.ts`, and update-related command tests.
- Affected contracts: the user-visible behavior of `install` / `ensure` for untracked `PATH` installs and the install-state precondition for `update --all`.
- Dependencies: no new runtime dependency.
