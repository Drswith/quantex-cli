## ADDED Requirements

### Requirement: Windows standalone binary self-upgrade MUST keep entry point copies consistent

Windows standalone binary installs SHALL treat same-directory `quantex.exe` and `qtx.exe` files as equivalent entry point copies of the same Quantex install. When binary self-upgrade replaces either known Windows entry point, it MUST refresh the peer entry point copy from the verified replacement and manual uninstall or recovery guidance MUST account for both files.

#### Scenario: Upgrading from the short Windows entry point

- **GIVEN** Quantex is installed on Windows by `install.ps1`
- **AND** the user runs `qtx upgrade`
- **WHEN** the delayed binary replacement completes successfully
- **THEN** both `qtx.exe` and `quantex.exe` in the install directory contain the upgraded Quantex binary

#### Scenario: Upgrading from the long Windows entry point

- **GIVEN** Quantex is installed on Windows by `install.ps1`
- **AND** the user runs `quantex upgrade`
- **WHEN** the delayed binary replacement completes successfully
- **THEN** both `quantex.exe` and `qtx.exe` in the install directory contain the upgraded Quantex binary

#### Scenario: Replacing a custom Windows binary name

- **GIVEN** Quantex is running from a standalone Windows binary whose filename is not `quantex.exe` or `qtx.exe`
- **WHEN** binary self-upgrade schedules replacement
- **THEN** Quantex replaces only the running executable path
- **AND** it does not infer or create a peer alias file

#### Scenario: Manually uninstalling a Windows standalone binary install

- **GIVEN** Quantex is installed on Windows by `install.ps1`
- **WHEN** a user follows manual standalone-binary uninstall or recovery guidance
- **THEN** the guidance identifies both `quantex.exe` and `qtx.exe` as files to remove or replace together
