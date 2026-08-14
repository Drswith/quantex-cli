## ADDED Requirements

### Requirement: Documented standalone installers MUST resolve published release archives

The documented standalone installers (`install.sh` and `install.ps1`) SHALL request the compressed release archive that the release matrix publishes for the resolved platform and architecture: a `.tar.gz` archive on macOS and Linux, and a `.zip` archive on Windows. They MUST NOT request a raw uncompressed binary asset name, and they MUST NOT request a Windows architecture asset that is not published.

#### Scenario: Installing on macOS or Linux via install.sh

- **GIVEN** a supported macOS or Linux host
- **WHEN** a user runs the documented `install.sh` installer
- **THEN** the installer MUST request `quantex-<platform>-<arch>.tar.gz`
- **AND** it MUST NOT request the uncompressed `quantex-<platform>-<arch>` asset name

#### Scenario: Installing on Windows ARM64 via install.ps1

- **GIVEN** the resolved Windows host architecture is `ARM64`
- **AND** Quantex publishes `quantex-windows-x64.exe.zip` but publishes no Windows ARM64 asset
- **WHEN** a user runs the documented `install.ps1` installer
- **THEN** the installer MUST request `quantex-windows-x64.exe.zip`
- **AND** it MUST NOT request a Windows ARM64 asset name

#### Scenario: Resolving the Windows host architecture from a 32-bit PowerShell process

- **GIVEN** a 64-bit Windows host running a 32-bit PowerShell process
- **AND** the process reports `PROCESSOR_ARCHITECTURE` as `x86` and `PROCESSOR_ARCHITEW6432` as the host architecture
- **WHEN** a user runs the documented `install.ps1` installer
- **THEN** the installer MUST resolve the architecture from `PROCESSOR_ARCHITEW6432`
- **AND** it MUST request the published x64 asset rather than rejecting the host as unsupported

#### Scenario: Installing on a genuine 32-bit Windows host

- **GIVEN** a Windows host that reports `x86` with no `PROCESSOR_ARCHITEW6432` value
- **WHEN** a user runs the documented `install.ps1` installer
- **THEN** the installer MUST fail closed with an unsupported-architecture error

### Requirement: Documented standalone installers MUST verify archive integrity before install

The documented standalone installers SHALL download the release `SHA256SUMS.txt` from the same release as the archive and SHALL verify the downloaded archive against the checksum recorded for that archive name before extracting or installing it. They MUST fail closed when the archive is not listed, when no SHA-256 implementation is available, or when the computed checksum does not match.

#### Scenario: Downloaded archive checksum does not match the published checksum

- **GIVEN** a user runs a documented standalone installer
- **AND** the downloaded archive's SHA-256 differs from the value recorded in `SHA256SUMS.txt`
- **THEN** the installer MUST abort without installing the archive contents
- **AND** it MUST leave any previously installed executable intact

#### Scenario: Published checksum list does not cover the requested archive

- **GIVEN** a user runs a documented standalone installer
- **AND** `SHA256SUMS.txt` contains no entry for the requested archive name
- **THEN** the installer MUST abort without installing the archive contents

### Requirement: Documented standalone installers MUST replace executables only from verified staged content

The documented standalone installers SHALL extract only the expected binary entry from the verified archive into temporary storage, and SHALL replace the installed executable only after that extraction succeeds. They MUST NOT write network response bytes or unverified archive contents directly onto an installed executable path. After a successful replacement, the peer alias (`qtx` on POSIX, `qtx.exe` on Windows) MUST be refreshed from the installed executable, and temporary storage MUST be removed on success or failure.

#### Scenario: Reinstalling over an existing standalone install when the download fails

- **GIVEN** Quantex is already installed through a documented standalone installer
- **WHEN** the user reruns the installer and the download or verification fails
- **THEN** the previously installed executable MUST remain intact
- **AND** the installer MUST NOT leave a truncated or partially written executable at the installed path

#### Scenario: Successful standalone install refreshes both entry points

- **GIVEN** a verified archive whose expected binary entry extracted successfully
- **WHEN** the installer finishes
- **THEN** the installed executable MUST contain the extracted binary
- **AND** the peer alias MUST resolve to that installed executable
- **AND** temporary staging storage MUST be removed
