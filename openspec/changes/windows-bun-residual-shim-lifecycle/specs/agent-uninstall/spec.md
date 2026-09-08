## MODIFIED Requirements

### Requirement: Bun uninstall MUST reconcile only an unchanged provider-owned global-bin link

When Bun reports a successful package removal and a fresh provider probe conclusively reports the top-level package absent, Quantex MUST remove a remaining global-bin symbolic link only when evidence captured before removal proves that the package declared that binary, the link target belongs to the package or one of its declared runtime dependencies, and the link device, inode, and target are unchanged. Quantex MUST NOT delete a regular file, a changed link, an unproven path, or an alternate source elsewhere on `PATH`, except for the proven-orphaned Windows Bun shim pair defined below.

On Windows, Bun's global-bin entry is a regular-file launcher `{binary}.exe` plus a sibling `{binary}.bunx` sidecar, not a symbolic link. When evidence captured before removal proves that the package declared that binary, both files are regular files inside the directory reported by `bun pm bin -g`, and the captured size and modification time of both files are unchanged after bun reports the package absent, Quantex MUST remove that `.exe`/`.bunx` pair. Quantex MUST NOT delete a lone `.exe`, a `.bunx` without its matching `.exe`, a changed file, an unproven path, or an executable outside that Bun global-bin directory.

When the bound provider conclusively reports the package absent but a residual executable still remains on `PATH` after that cleanup, the conflicting-source uninstall failure MUST tell the user that Bun may have left `{binary}.exe` and `{binary}.bunx` in its global bin and that deleting that pair unblocks a later install.

#### Scenario: Bun leaves the removed package's dependency link behind

- **GIVEN** a Bun-managed package declares the agent binary
- **AND** Bun's global-bin path is a symbolic link to that package or a declared runtime dependency
- **WHEN** Bun removes the top-level package but leaves the exact same link and target behind
- **AND** a fresh Bun package probe reports the top-level package absent
- **THEN** Quantex removes that stale global-bin link
- **AND** normal uninstall absence verification can succeed

#### Scenario: The global-bin link changes during removal

- **GIVEN** Quantex captured a provider-owned Bun global-bin link before removal
- **WHEN** the path's device, inode, or link target differs after Bun removal
- **THEN** Quantex preserves the changed path
- **AND** the normal uninstall postcondition reports any remaining executable instead of treating it as provider-owned cleanup

#### Scenario: Another executable source remains

- **GIVEN** the stale Bun-owned link is safely removed after package removal
- **AND** another copy of the agent executable remains elsewhere on `PATH`
- **WHEN** Quantex verifies uninstall absence
- **THEN** Quantex preserves the other copy
- **AND** it returns the typed `conflicting-source` failure

#### Scenario: Bun leaves the Windows shim pair behind

- **GIVEN** a Bun-managed package declares the agent binary
- **AND** Bun's global-bin path contains regular files `{binary}.exe` and `{binary}.bunx`
- **WHEN** Bun removes the top-level package but leaves that exact unchanged pair behind
- **AND** a fresh Bun package probe reports the top-level package absent
- **THEN** Quantex removes both files
- **AND** normal uninstall absence verification can succeed when no other copy remains on `PATH`

#### Scenario: An unproven Windows regular file is preserved

- **GIVEN** a file named `{binary}.exe` remains in Bun's global bin after package removal
- **AND** Quantex did not capture a matching `{binary}.bunx` sidecar before removal, or the captured size or modification time changed
- **WHEN** Quantex reconciles leftover Bun global-bin files
- **THEN** Quantex preserves the remaining file
- **AND** the normal uninstall postcondition reports any remaining executable instead of deleting an unproven path

#### Scenario: Residual Windows shim guidance after cleanup cannot clear PATH

- **GIVEN** bun conclusively reports the managed package absent
- **AND** another copy of the agent executable remains on `PATH`
- **WHEN** `qtx uninstall` returns the conflicting-source leftover-PATH failure
- **THEN** the human message still distinguishes that failure from unmanaged and provider-failure outcomes
- **AND** it names `{binary}.exe` and `{binary}.bunx` in Bun's global bin as the leftover pair to delete
