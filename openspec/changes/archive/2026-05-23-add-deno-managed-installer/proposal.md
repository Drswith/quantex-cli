## Why

Some agent CLIs can be distributed as Deno global executables through `deno install --global`, but Quantex currently has no first-class managed Deno installer type. Those agents cannot be modeled consistently for install, update, uninstall, diagnostics, state recording, or stable structured output.

This work is OpenSpec-required because it changes agent catalog install-method metadata, package-manager lifecycle behavior, structured installer availability output, command schemas, and product-facing lifecycle expectations.

## What Changes

- Add `deno` as a managed package-manager install type for downstream agent lifecycle operations.
- Add optional `packages.deno` metadata and a `denoInstall(...)` catalog helper that supports executable names and package-specific install arguments.
- Detect whether the `deno` command is available in `PATH`.
- Execute Deno-managed install, update, batch update, and uninstall operations through Deno global executable commands.
- Use `deno install --global` for install, `deno install --global --force` for managed update, and `deno uninstall --global <binary>` for uninstall.
- Persist the agent binary name for Deno-managed installs so uninstall does not guess the global executable name from the package specifier.
- Render Deno install guidance in lifecycle surfaces that already expose install methods.
- Include Deno availability in `capabilities`, `doctor`, and schema output.
- Keep Quantex self-upgrade and `defaultPackageManager` scoped to existing self-install sources; Deno is an agent lifecycle installer, not a Quantex self-upgrade provider.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Supported agent entries may declare Deno global managed install methods and Deno package metadata.
- `agent-update`: Deno-managed installs participate in managed install, update, batch update, uninstall, diagnostics, and structured installer schema output.
- `code-quality-tooling`: Isolation smoke coverage includes Deno-managed lifecycle routing.

## Impact

- Affected code: `src/agents/types.ts`, `src/agents/methods.ts`, `src/agents/schema.ts`, `src/package-manager/`, `src/utils/detect.ts`, `src/commands/capabilities.ts`, `src/commands/doctor.ts`, `src/commands/schema.ts`, update planning/services, agent definitions, smoke scripts, and related tests.
- Affected structured output: `quantex capabilities --json` and `quantex doctor --json` installer maps gain a `deno` key; `quantex schema capabilities` and `quantex schema doctor` document that key.
- Affected state: Deno-managed installed-agent state records `binaryName` in addition to package name and install args so global uninstall uses the executable name.
- No new runtime dependency is required.

## Cross-Platform Considerations

- Windows, macOS, and Linux all use the `deno` executable when it is available.
- Deno global executables require the Deno install root to be on PATH; Quantex reports Deno command availability but does not mutate shell profiles.
- Deno-managed agent support does not imply Quantex manages arbitrary Deno project dependency workflows, `deno task`, local `deno.json`, or Deno Deploy.
