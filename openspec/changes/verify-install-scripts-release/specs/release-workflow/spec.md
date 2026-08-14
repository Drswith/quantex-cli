# release-workflow Delta

## ADDED Requirements

### Requirement: Published releases MUST exercise the documented standalone installers

After the release workflow makes the exact GitHub Release public, it SHALL run a non-cancelling matrix against that same immutable `v<version>` release. The matrix MUST run the versioned `install.sh` on at least one hosted Linux runner and one hosted macOS runner, and MUST run the versioned `install.ps1` on a hosted Windows runner. Each leg SHALL set the repository and release tag explicitly, install into an isolated scratch directory, and verify that the installed primary executable and documented alias run successfully and report the expected release version.

#### Scenario: A published stable release exercises every documented installer

- **WHEN** `release.yml` completes public GitHub Release closure for `v<version>`
- **THEN** it MUST run the release-tagged `install.sh` on Linux and macOS
- **AND** it MUST run the release-tagged `install.ps1` on Windows
- **AND** each installer MUST download from the exact `v<version>` release rather than an unpinned `latest` release

#### Scenario: POSIX installer smoke succeeds

- **GIVEN** the public release contains the platform archive and `SHA256SUMS.txt`
- **WHEN** a Linux or macOS matrix leg runs `install.sh` in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex` and `qtx` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: Windows installer smoke succeeds

- **GIVEN** the public release contains `quantex-windows-x64.exe.zip` and `SHA256SUMS.txt`
- **WHEN** the Windows matrix leg runs `install.ps1` in its scratch directory
- **THEN** the installer MUST complete successfully
- **AND** both `quantex.exe` and `qtx.exe` in that directory MUST execute successfully
- **AND** their output MUST include the expected release version

#### Scenario: An installer cannot consume the published release

- **WHEN** any installer matrix leg cannot download, verify, extract, or execute the exact release
- **THEN** that leg MUST fail the release workflow
- **AND** its failure MUST identify the installer and hosted runner that failed
- **AND** the other matrix legs MUST still be allowed to report their own result

#### Scenario: Post-publish installer verification fails

- **WHEN** the installer matrix fails after the GitHub Release, tag, or npm version is public
- **THEN** the release workflow MUST remain failed and report the release as not fully verified
- **AND** it MUST NOT delete, move, or retag the immutable release to hide the failure
- **AND** maintainers MUST be able to rerun the same tag after transient remediation or a corrective change
