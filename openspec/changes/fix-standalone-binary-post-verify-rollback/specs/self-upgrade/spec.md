## MODIFIED Requirements

### Requirement: Binary self-upgrade MUST support platform-safe replacement

The binary self-upgrade path SHALL use a replacement strategy that matches platform constraints.

#### Scenario: Replacing the running binary on macOS or Linux

- GIVEN the current platform is macOS or Linux
- WHEN a binary upgrade is executed
- THEN Quantex performs in-place replacement of the installed executable

#### Scenario: Verified replacement is not rolled back when backup cleanup fails

- GIVEN the current platform is macOS or Linux
- AND the downloaded binary passes checksum verification
- AND the new binary is moved into place and post-install verification succeeds
- WHEN removing the `.bak` backup file fails (for example, permission or I/O error)
- THEN Quantex reports the upgrade attempt as failed
- AND the live executable remains the newly verified binary
- AND Quantex does not restore the previous executable solely because backup cleanup failed

#### Scenario: Replacing the running binary on Windows

- GIVEN the current platform is Windows
- WHEN a binary upgrade is executed
- THEN Quantex uses delayed replacement semantics compatible with Windows file locking behavior
