## Why

Some supported agent CLIs are distributed through `uv tool install`, but Quantex currently represents those paths as unmanaged binary command hints or one-off self-update commands. That keeps uv-installed agents out of the shared managed lifecycle used for install, update, uninstall, diagnostics, state recording, and structured output.

This work is OpenSpec-required because it changes agent catalog install-method metadata, package-manager lifecycle behavior, structured installer availability output, and update planning.

## What Changes

- Add `uv` as a managed package-manager install type for agent lifecycle operations.
- Add optional `packages.uv` metadata and a `uvToolInstall(...)` catalog helper that supports package-specific install arguments such as `--python 3.12` or `--no-cache`.
- Detect whether the `uv` command is available in `PATH`.
- Execute uv-managed install, update, batch update, and uninstall operations through `uv tool` commands.
- Render uv install guidance in lifecycle surfaces that already expose install methods.
- Include uv availability in `capabilities`, `doctor`, and doctor schema output.
- Migrate verified uv-based agent definitions from unmanaged `binaryInstall(...)` hints to managed uv methods, starting with OpenHands CLI and Mistral Vibe; also model Kimi CLI's documented uv tool install path where supported.
- Keep Quantex self-upgrade and `defaultPackageManager` scoped to existing self-install sources; uv is an agent lifecycle installer, not a Quantex self-upgrade provider.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Supported agent entries may declare uv tool managed install methods and uv package metadata.
- `agent-update`: uv-managed installs participate in managed install, update, batch update, uninstall, diagnostics, and structured installer schema output.

## Impact

- Affected code: `src/agents/types.ts`, `src/agents/methods.ts`, `src/package-manager/`, `src/utils/detect.ts`, `src/commands/capabilities.ts`, `src/commands/doctor.ts`, `src/commands/schema.ts`, update planning/services, agent definitions, and related tests.
- Affected structured output: `quantex capabilities --json` and `quantex doctor --json` installer maps gain a `uv` key; `quantex schema doctor` documents that key.
- No new runtime dependency is required.

## Cross-Platform Considerations

- Windows, macOS, and Linux all use the `uv` executable when it is available.
- uv-managed agent support does not imply Quantex installs Python, manages virtual environments directly, or treats arbitrary `uv run` workflows as lifecycle-managed installs.
- Agent definitions remain responsible for platform support. For example, OpenHands remains macOS/Linux only because its upstream CLI docs route Windows users through WSL.
