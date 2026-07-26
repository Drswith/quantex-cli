## ADDED Requirements

### Requirement: Windows standalone installer MUST stage downloads before replacing live binaries

The documented Windows standalone installer (`install.ps1`) SHALL download the release asset into a temporary location and SHALL replace the live `quantex.exe` entry point only after that staged download completes successfully with a non-empty file. It MUST NOT stream or write network response bytes directly onto the live executable path. After a successful replacement, it MUST refresh the peer `qtx.exe` copy from the installed `quantex.exe`.

#### Scenario: Reinstall over an existing Windows standalone install

- **GIVEN** Quantex is already installed on Windows via `install.ps1` as `quantex.exe` (and optionally `qtx.exe`)
- **WHEN** a user reruns the documented `install.ps1` installer and the download fails after the destination file would have been opened
- **THEN** the installer MUST leave the previous live `quantex.exe` intact
- **AND** it MUST NOT leave a truncated or partially written live executable from the failed download

#### Scenario: Successful Windows standalone install refreshes both entry points

- **GIVEN** a successful staged download of the Windows release asset
- **WHEN** `install.ps1` finishes installation
- **THEN** `quantex.exe` contains the newly downloaded binary
- **AND** `qtx.exe` is copied from that installed `quantex.exe`
