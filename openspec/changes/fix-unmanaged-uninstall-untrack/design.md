## Approach

Use existing `canUninstallInstallType()` from installer capabilities. When the recorded install type cannot invoke a package-manager uninstall, `uninstallAgent()` removes the installed-agent state entry and returns success.

## Non-goals

- Running reverse install scripts or deleting unmanaged binaries from disk.
- Changing managed uninstall ordering (package uninstall before state removal).

## Risks

- Users may interpret success as the upstream tool was removed from disk. Human uninstall output already describes Quantex lifecycle actions; no new flag is added in this narrow fix.
