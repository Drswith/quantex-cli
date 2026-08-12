## ADDED Requirements

### Requirement: Bun uninstall MUST reconcile only an unchanged provider-owned global-bin link

When Bun reports a successful package removal and a fresh provider probe conclusively reports the top-level package absent, Quantex MUST remove a remaining global-bin symbolic link only when evidence captured before removal proves that the package declared that binary, the link target belongs to the package or one of its declared runtime dependencies, and the link device, inode, and target are unchanged. Quantex MUST NOT delete a regular file, a changed link, an unproven path, or an alternate source elsewhere on `PATH`.

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
