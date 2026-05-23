## Why

Users who standardize on mise cannot currently keep Quantex-managed agent installs and updates aligned with their preferred tool manager. Quantex already records managed install sources for package-manager parity, so adding mise support fits the existing agent lifecycle scope.

This work is OpenSpec-required because it changes agent catalog install-method metadata, package-manager lifecycle behavior, user configuration normalization, stable installer capability output, and update planning.

## What Changes

- Add `mise` as a managed agent lifecycle installer for supported agent definitions.
- Add optional `packages.mise` metadata for mise tool references such as `npm:@openai/codex`.
- Detect whether the `mise` command is available in `PATH`.
- Execute mise-managed install, update, batch update, uninstall, and best-effort installed-version inspection through mise commands.
- Render mise install guidance in lifecycle surfaces that already expose install methods.
- Include mise availability in `capabilities`, `doctor`, and doctor schema output.
- Allow `defaultPackageManager` to prefer mise when an agent exposes a mise method, without changing fallback order for agents that do not.
- Add a verified mise path for Codex CLI through mise's npm backend.
- Keep Quantex self-upgrade scoped to existing self-install sources; mise is an agent lifecycle installer, not a Quantex self-upgrade provider.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Supported agent entries may declare mise managed install methods and mise package metadata.
- `agent-update`: mise-managed installs participate in managed install, update, batch update, uninstall, diagnostics, and structured installer schema output.
- `config-surface`: `defaultPackageManager` may normalize to `mise` as a supported preference.
- `product-readme`: User-facing configuration and capability documentation describe mise as a managed agent installer.

## Impact

- Affected code: `src/agents/types.ts`, `src/agents/schema.ts`, `src/package-manager/`, `src/utils/detect.ts`, `src/utils/install.ts`, `src/config/`, `src/commands/capabilities.ts`, `src/commands/doctor.ts`, `src/commands/schema.ts`, agent definitions, and related tests.
- Affected structured output: `quantex capabilities --json` and `quantex doctor --json` installer maps gain a `mise` key; `quantex schema doctor` documents that key.
- Affected product docs: README configuration guidance notes that `defaultPackageManager` can prefer mise for agent installs.
- No new runtime dependency is required; mise is invoked only when installed and selected by catalog/recorded state.
