## Context

Quantex already models managed installers with a shared contract: catalog metadata names the package, command surfaces render install guidance, package-manager providers execute lifecycle operations, installed state records the selected source, and diagnostics expose installer availability. The current managed set covers Bun, npm, Homebrew, Cargo, pip, uv, and winget.

Deno differs from the existing package managers in two important ways:

- Global executable installation uses `deno install --global [PACKAGE_OR_URL]` plus permission and naming flags, not a registry-only package install command.
- Global uninstall takes the script or executable name, e.g. `deno uninstall --global serve`, not the original package or URL specifier.

Deno's `deno update` command updates project dependencies in `deno.json` or `package.json`; it is not the right lifecycle operation for a global executable installed through `deno install --global`. For Quantex's managed agent lifecycle, update should therefore repeat the global install command with `--force`.

## Decisions

1. Add `deno` to `ManagedInstallType` and `InstallType`.
2. Add `packages.deno` for the global package or URL specifier.
3. Add an optional `binaryName` field to install methods and installed-agent state for installer-specific executable naming.
4. Make `denoInstall(packageName?, binaryName?, packageInstallArgs?)` produce a managed method with `type: 'deno'`.
5. Render Deno guidance as `deno install --global <args> <package>`, preserving package-specific args before the package specifier.
6. Execute Deno install as `deno install --global <args> <package>`.
7. Execute Deno update as `deno install --global --force <args> <package>`.
8. Execute Deno uninstall as `deno uninstall --global <binaryName>`, falling back to package name only when no binary name is available.
9. Do not add Deno to Quantex self-upgrade providers or `defaultPackageManager`.

## Scope Boundaries

- This change only manages Deno global executable installs for agent CLIs.
- It does not manage local Deno project dependencies, Deno tasks, Deno Deploy, or arbitrary workflow orchestration.
- It does not try to infer global executable names from remote module paths when the catalog can provide the agent `binaryName`.
- It does not add latest-version lookup for Deno-managed agents, because Deno global installs do not expose a stable equivalent to npm/Bun global package version lookup in Quantex today.

## Risks

- Some Deno install targets require permission flags or a custom `--name`; catalog entries must preserve those flags through `packageInstallArgs` and `binaryName`.
- If a future Deno CLI changes global install/update semantics, the provider tests and smoke fake must be updated with that command contract.
- Existing installed-agent state will not have `binaryName`; uninstall falls back to package name for older state, but newly installed Deno-managed agents must persist `binaryName`.
