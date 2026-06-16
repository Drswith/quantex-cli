## ADDED Requirements

### Requirement: Windows delayed binary swap MUST restore backup when replacement move fails

When Windows binary self-upgrade has created a `.bak` backup of the live executable, a failed replacement move SHALL restore the backup to the live executable path before exiting.

#### Scenario: Replacement move fails after backup creation

- GIVEN the current platform is Windows
- AND delayed binary replacement created a `.bak` backup of the live executable
- WHEN moving the downloaded replacement into the live executable path fails
- THEN Quantex restores the `.bak` backup to the live executable path when possible
- AND the scheduled replacement exits with a non-zero status without leaving the live path empty
