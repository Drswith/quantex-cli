## Context

`uninstallInstalledAgentOutcome` already clears installed-agent state for install types that cannot be uninstalled (`script`, `binary`) and returns success without invoking a package manager. The command layer then polls for provider absence and `PATH` executable absence. For install-effect providers, observation is derived from executable presence, so the postcondition can never succeed while the binary remains installed—the normal case after a script/binary install.

## Goals / Non-Goals

**Goals:**

- Make tracked `script` / `binary` uninstall succeed by clearing Quantex state and any lifecycle receipt.
- Preserve the live executable; Quantex does not own removal of upstream script/binary installs.
- Keep managed-provider uninstall postconditions unchanged.

**Non-Goals:**

- Adding package-manager uninstall for script/binary providers.
- Deleting user-installed executables from disk or `PATH`.
- Changing unmanaged (no tracked state) uninstall outcomes.

## Decisions

1. Branch in `uninstallCommand` on `canUninstallInstallType(installedState.installType)` before managed receipt synthesis and postcondition polling.
2. On state-only success: remove installed state (already done by `uninstallInstalledAgentOutcome`), remove any lifecycle receipt, return success.
3. Do not create a lifecycle receipt for uninstallable install types during uninstall; there is no provider removal to verify.
4. Keep the existing managed postcondition path for uninstallable package providers.

## Risks / Trade-offs

- Users may expect uninstall to delete the upstream binary. Existing specs already define script/binary uninstall as state clearing; human messaging should remain clear that Quantex untracks rather than deletes unmanaged installs.
- Skipping receipt creation for these types avoids the current failure path that writes a receipt and then restores state, which is an improvement rather than a regression.

## Migration Plan

- No state schema migration.
- After merge, archive the OpenSpec change once specs are synced.
