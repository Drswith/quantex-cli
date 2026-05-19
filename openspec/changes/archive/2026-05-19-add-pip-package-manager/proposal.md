## Why

Some lifecycle-managed coding agents are distributed as Python packages via pip (e.g., Mistral Vibe). Quantex currently has managed installers for Bun, npm, Homebrew, Cargo, and winget, but it cannot model or execute a first-class pip install path. Python-based agent CLIs are therefore represented as unmanaged binary command hints instead of managed lifecycle methods.

This work is OpenSpec-required because it changes agent catalog install-method metadata, managed lifecycle execution, diagnostic output, and batch update planning.

## What Changes

- Add `pip` as a managed package-manager install type.
- Add `pip` to `AgentPackageMetadata` for agent definitions.
- Detect whether `pip` is available in `PATH`, with fallback to `python -m pip` detection.
- Execute pip-managed install, update, batch update, and uninstall operations through pip commands.
- Render pip install guidance in resolve/exec/list/info surfaces that already expose install methods.
- Include pip availability in `capabilities` and `doctor` diagnostics.
- Migrate verified pip-based agent definitions (starting with Mistral Vibe) from unmanaged `binaryInstall(...)` to the new managed `pipInstall(...)` method.
- Keep Quantex self-upgrade and the `defaultPackageManager` configuration scoped to the existing supported self-install sources; pip is an agent lifecycle installer, not a Quantex self-upgrade provider.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Supported agent entries may declare pip managed install methods and package metadata.
- `agent-update`: pip-managed installs participate in managed install, update, batch update, uninstall, and diagnostic planning.

## Impact

- Affected code: `src/agents/types.ts`, `src/agents/methods.ts`, `src/package-manager/`, `src/utils/detect.ts`, `src/commands/capabilities.ts`, `src/commands/doctor.ts`, agent definitions, and related tests.
- Affected structured output: `quantex capabilities --json` and `quantex doctor --json` installer maps gain a `pip` key.
- No new runtime dependency is required.

## Cross-Platform Considerations

- Windows: Use `pip` command directly or `python -m pip` as fallback.
- macOS/Linux: Use `pip` command directly or `python -m pip` as fallback. Some systems may require `pip3` instead of `pip`.
- The pip command detection will try `pip`, then `pip3`, then `python -m pip` as fallback strategies.
